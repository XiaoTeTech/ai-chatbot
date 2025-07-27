import asyncio
import json
import re
import time
import uuid
from typing import List
from typing import Optional

from app.context import set_current_user
from app.libs.fastapi_globals import g
from app.log import logger
from app.models import ChatHistory
from app.models import UserChatConfig
from app.models import Conversation  # 添加 Conversation 导入
from app.tesla_ai.agent import Intent
from app.tesla_ai.agent import TeslaAgent
from app.tesla_ai.command_parser import exec_quick_command
from app.tesla_ai.utils import CommandModeManager
from app.tesla_ai.utils import have_these_words
from app.utils.tesla_auth import get_user_by_session_token_cache
from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request
from fastapi.responses import StreamingResponse
from leancloud import User
from pydantic import BaseModel

llm_router = APIRouter(tags=["llm"])

# 数据模型
class Message(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[Message]
    stream: Optional[bool] = False
    conversation_id: Optional[int] = None  # 改为 int 类型
    from_web: Optional[bool] = False  # 添加 from_web 参数


# 认证
async def verify_api_key(request: Request) -> User:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "message": "Missing or invalid Authorization header",
                    "type": "authentication_error",
                    "code": 401,
                }
            },
        )

    api_key = auth_header.split(" ")[1]
    try:
        user = await get_user_by_session_token_cache(api_key)
        if not user:
            raise HTTPException(
                status_code=401,
                detail={
                    "error": {
                        "message": "Invalid API Key",
                        "type": "authentication_error",
                        "code": 401,
                    }
                },
            )
        return user
    except Exception:
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "message": "Invalid API Key",
                    "type": "authentication_error",
                    "code": 401,
                }
            },
        )


# 辅助函数
def is_question(sentence: str) -> bool:
    sentence = sentence.strip()
    if len(sentence) > 60:
        return False

    question_words = [
        "什么",
        "哪里",
        "哪儿",
        "谁",
        "为什么",
        "怎么",
        "怎么样",
        "何时",
        "多少",
        "多",
        "哪",
        "是否",
    ]
    question_patterns = [
        r"^是不是",
        r"^可不可以",
        r"^能不能",
        r"^要不要",
        r"^需不需要",
        r"^有没有",
        r"^行不行",
        r"^中不中",
        r"^好不好",
    ]

    return (
        any(sentence.startswith(word) for word in question_words)
        or any(re.match(pattern, sentence) for pattern in question_patterns)
        or sentence.endswith("吗")
        or any(word in sentence for word in question_words)
    )


def is_navigation_broadcast_hybrid_no_cut(text: str) -> bool:
    if "？" in text:
        return False

    pattern = r"(左转|右转|直行|掉头|靠左|靠右|进入|驶入|通过|沿|上高架|下高架|走右侧两车道|路口|环岛|高架|方向)"
    if re.search(pattern, text):
        return True

    navigation_keywords = {"前方", "左转", "右转", "直行", "路口", "高架", "转道"}
    keyword_count = sum(1 for keyword in navigation_keywords if keyword in text)
    has_distance = bool(re.search(r"\d{1,4}\s*(米|公里)", text))
    return keyword_count >= 2 or (keyword_count >= 1 and has_distance)


async def generate_stream_chunk(
    chat_id: str, 
    model: str, 
    content: str = "", 
    finish_reason: Optional[str] = None,
    conversation_id: Optional[int] = None
) -> str:
    chunk = {
        "id": chat_id,
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": model,
        "choices": [
            {
                "index": 0,
                "delta": {"content": content} if content else {},
                "finish_reason": finish_reason,
            }
        ],
    }
    
    # 如果提供了 conversation_id，添加到 chunk 中
    if conversation_id is not None:
        chunk["conversation_id"] = conversation_id
        
    return f"data: {json.dumps(chunk)}\n\n"


# 核心处理逻辑
async def process_chat_request(
    request: ChatCompletionRequest,
    raw_request: Request,
    current_user: User,
    version: str = "v1",
    channel: str = "channel1",
) -> StreamingResponse:
    # 设置用户上下文
    set_current_user(current_user)
    g.is_from_rtc = version == "v2"

    # 获取 from_web 参数
    is_from_web = request.from_web or False

    # 验证输入
    if not request.messages:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "message": "No user message provided",
                    "type": "invalid_request_error",
                    "code": 400,
                }
            },
        )

    # 初始化 Agent 和输入
    user_input = request.messages[-1].content
    if channel != "channel2":
        user_input = Intent.format_user_input(request.messages[-1].content)
        if not user_input:
            return StreamingResponse([], media_type="text/event-stream")

    g.user_input = user_input
    agent = TeslaAgent(current_user)
    command_mode = await CommandModeManager(current_user.id).get_command_mode()

    # 处理快速命令
    command_response = await exec_quick_command(user_input, command_mode)
    await UserChatConfig.collect_llm_dau(current_user.id)
    if command_response is not None:

        async def stream_command_response():
            chat_id = f"chatcmpl-{uuid.uuid4()}"
            conversation_id = None

            # 如果是新对话，创建对话并在第一个 chunk 中包含 conversation_id
            if is_from_web and not request.conversation_id:
                # 创建新对话
                conversation = await Conversation.create_new_conversation_if_has_message(
                    user_id=current_user.id
                )
                conversation_id = conversation.id

                # 在第一个 chunk 中包含 conversation_id
                yield await generate_stream_chunk(
                    chat_id, request.model, command_response, None, conversation_id
                )
            else:
                conversation_id = request.conversation_id or await ChatHistory.get_voice_mode_conversation_id(current_user.id)
                yield await generate_stream_chunk(chat_id, request.model, command_response)

            yield await generate_stream_chunk(
                chat_id, request.model, "(stop)" if version == "v2" else None, "stop"
            )
            yield "data: [DONE]\n\n"

        async def save_command_message():
            if user_input != "退出。":
                if is_from_web:
                    conversation_id = request.conversation_id
                    if not conversation_id:
                        conversation = await Conversation.create_new_conversation_if_has_message(
                            user_id=current_user.id
                        )
                        conversation_id = conversation.id
                else:
                    conversation_id = await ChatHistory.get_voice_mode_conversation_id(current_user.id)

                await agent.memory.add_user_message(
                    message=user_input,
                    intent=Intent.CONTROL_VEHICLE,
                    conversation_id=conversation_id,
                )
                await agent.memory.add_ai_message(
                    message=command_response,
                    intent=Intent.CONTROL_VEHICLE,
                    conversation_id=conversation_id,
                )
                logger.info(f"input: {user_input} \noutput: {command_response}")

        asyncio.create_task(save_command_message())
        return StreamingResponse(
            stream_command_response(), media_type="text/event-stream"
        )

    # 获取会话历史和意图
    if is_from_web:
        conversation_id = request.conversation_id
        if not conversation_id:
            conversation = await Conversation.create_new_conversation_if_has_message(
                user_id=current_user.id
            )
            conversation_id = conversation.id
    else:
        conversation_id = await ChatHistory.get_voice_mode_conversation_id(current_user.id)

    chat_history = await ChatHistory.convert_to_recent_messages(
        user_id=agent.memory.user_id, minutes_before=30
    )
    intent = await Intent.determine_text_intent(user_input, chat_history)

    def must_answer(user_input):
        if have_these_words(*["特斯拉", "马斯克", "FSD"], content=user_input):
            return True
        return False

    # 特殊逻辑：跳过特定输入
    if (
        version == "v2"
        and channel == "channel1"
        and not must_answer(user_input)
        and (
            is_navigation_broadcast_hybrid_no_cut(user_input)
            or (intent is Intent.NOTHING and not is_question(user_input))
            or (intent is Intent.NEWS and len(user_input) > 25)
        )
    ):
        logger.info(f"Skipping input: {user_input}")
        return StreamingResponse([], media_type="text/event-stream")

    # 处理 AI 响应
    msg_id = await agent.memory.add_user_message(
        message=user_input, conversation_id=conversation_id, intent=intent
    )

    async def stream_ai_response():
        chat_id = f"chatcmpl-{msg_id if version == 'v1' else uuid.uuid4()}"

        # 如果是新对话，在第一个 chunk 中包含 conversation_id
        first_chunk_sent = False

        async for chunk in agent.ask(
            user_input,
            msg_id=msg_id,
            chat_history=chat_history,
            intent=intent,
            command_mode=command_mode,
            conversation_id=conversation_id,
        ):
            content = chunk.get("content", "")

            # 如果是新的 web 对话，在第一个有内容的 chunk 中包含 conversation_id
            if is_from_web and not request.conversation_id and content and not first_chunk_sent:
                yield await generate_stream_chunk(
                    chat_id, request.model, content, None, conversation_id
                )
                first_chunk_sent = True
            else:
                yield await generate_stream_chunk(chat_id, request.model, content)

        if version == "v2":
            yield await generate_stream_chunk(chat_id, request.model, "(stop)")
        yield await generate_stream_chunk(chat_id, request.model, finish_reason="stop")
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream_ai_response(), media_type="text/event-stream")


# 路由定义
@llm_router.post("/v1/chat/completions")
async def chat_completions_v1(
    request: ChatCompletionRequest,
    raw_request: Request,
    current_user: User = Depends(verify_api_key),
):
    return await process_chat_request(
        request, raw_request, current_user, version="v1", channel="channel2"
    )


@llm_router.post("/v2/chat/completions")
async def chat_completions_v2(
    request: ChatCompletionRequest,
    raw_request: Request,
    current_user: User = Depends(verify_api_key),
):
    return await process_chat_request(
        request, raw_request, current_user, version="v2", channel="channel1"
    )


@llm_router.post("/v2/chat/completions/channel2")
async def chat_completions_channel2(
    request: ChatCompletionRequest,
    raw_request: Request,
    current_user: User = Depends(verify_api_key),
):
    return await process_chat_request(
        request, raw_request, current_user, version="v2", channel="channel2"
    )
