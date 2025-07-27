import { auth } from '@/app/(auth)/auth';
import { externalChatService } from '@/lib/api/external-chat-service';
import { transformVoteTypeToInteractionType } from '@/lib/api/data-transformers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return new Response('chatId is required', { status: 400 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 检查是否有lcSessionToken
  if (!session.user.lcSessionToken) {
    return new Response('Missing LC Session Token', { status: 401 });
  }

  try {
    const conversationId = Number.parseInt(chatId);
    if (Number.isNaN(conversationId)) {
      return new Response('Invalid conversation ID', { status: 400 });
    }

    // 获取聊天历史，其中包含投票状态
    const chatHistoryResponse = await externalChatService.getChatHistory(
      session.user.lcSessionToken,
      conversationId,
    );

    // 转换投票数据格式以兼容前端
    const votes = chatHistoryResponse.items
      .filter((item) => item.vote_status)
      .map((item) => ({
        chatId: chatId,
        messageId: item.msg_id.toString(),
        isUpvoted: item.vote_status === 'praise',
      }));

    return Response.json(votes, { status: 200 });
  } catch (error) {
    console.error('Failed to get votes:', error);
    return new Response('Failed to get votes', { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const {
    chatId,
    messageId,
    type,
  }: { chatId: string; messageId: string; type: 'up' | 'down' } =
    await request.json();

  if (!chatId || !messageId || !type) {
    return new Response('messageId and type are required', { status: 400 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 检查是否有lcSessionToken
  if (!session.user.lcSessionToken) {
    return new Response('Missing LC Session Token', { status: 401 });
  }

  try {
    const conversationId = Number.parseInt(chatId);
    const msgId = Number.parseInt(messageId);

    if (Number.isNaN(conversationId) || Number.isNaN(msgId)) {
      return new Response('Invalid conversation or message ID', {
        status: 400,
      });
    }

    // 首先获取当前投票状态
    const chatHistoryResponse = await externalChatService.getChatHistory(
      session.user.lcSessionToken,
      conversationId,
    );

    const currentMessage = chatHistoryResponse.items.find(
      (item) => item.msg_id === msgId,
    );

    const currentVoteStatus = currentMessage?.vote_status;

    // 转换投票类型为交互类型
    const interactionType = transformVoteTypeToInteractionType(
      type,
      currentVoteStatus,
    );

    // 调用外部API进行投票
    const result = await externalChatService.interactWithMessage(
      session.user.lcSessionToken,
      {
        conversation_id: conversationId,
        msg_id: msgId,
        interaction_type: interactionType,
      },
    );

    return Response.json({ vote_status: result.vote_status }, { status: 200 });
  } catch (error) {
    console.error('Failed to vote message:', error);
    return new Response('Failed to vote message', { status: 500 });
  }
}
