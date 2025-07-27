import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import { Chat } from '@/components/chat';
import { externalChatService } from '@/lib/api/external-chat-service';
import {
  transformChatHistoryToDBMessages,
  transformDBMessagesToUIMessages,
} from '@/lib/api/data-transformers';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;

  const session = await auth();

  if (!session || !session.user) {
    return notFound();
  }

  // 检查是否有lcSessionToken
  if (!session.user.lcSessionToken) {
    return notFound();
  }

  try {
    // 获取对话详情
    const conversationId = Number.parseInt(id);
    if (Number.isNaN(conversationId)) {
      return notFound();
    }

    const chat = await externalChatService.getConversationDetail(
      session.user.lcSessionToken,
      conversationId,
    );

    if (!chat) {
      return notFound();
    }

    // 获取聊天历史消息
    const chatHistoryResponse = await externalChatService.getChatHistory(
      session.user.lcSessionToken,
      conversationId,
      undefined, // keyword
      1, // page
      100, // pageSize - 获取所有消息
    );

    const messagesFromDb =
      transformChatHistoryToDBMessages(chatHistoryResponse);

    // 转换为UI消息格式
    const uiMessages = transformDBMessagesToUIMessages(messagesFromDb);

    // 创建一个模拟的chat对象，用于兼容现有组件
    const chatForComponent = {
      id: chat.id.toString(),
      title: chat.title || '新对话',
      userId: session.user.id || '',
      visibility: 'private' as const,
      createdAt: new Date(chat.start_time * 1000),
    };

    // 获取cookie中的模型设置
    const cookieStore = await cookies();
    const chatModelFromCookie = cookieStore.get('chat-model');
    const selectedChatModel = chatModelFromCookie?.value || DEFAULT_CHAT_MODEL;

    return (
      <>
        <Chat
          id={chatForComponent.id}
          initialMessages={uiMessages}
          selectedChatModel={selectedChatModel}
          selectedVisibilityType={chatForComponent.visibility}
          isReadonly={false}
        />
        <DataStreamHandler id={id} />
      </>
    );
  } catch (error) {
    console.error('Failed to load chat:', error);
    return notFound();
  }
}
