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
import { ConversationIdHandler } from '@/components/conversation-id-handler';
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
    // 检查是否为 UUID 格式的旧链接
    if (id.includes('-') && id.length > 10) {
      // 这是一个 UUID 格式的旧链接，重定向到首页
      console.log('🔄 Redirecting UUID chat link to home:', id);
      return (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h1 className="text-2xl font-bold mb-4">对话已过期</h1>
          <p className="text-gray-600 mb-4">
            此对话链接已过期，请返回首页开始新的对话。
          </p>
          <a
            href="/"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            返回首页
          </a>
        </div>
      );
    }

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
        <ConversationIdHandler chatId={id} />
      </>
    );
  } catch (error) {
    console.error('Failed to load chat:', error);
    return notFound();
  }
}
