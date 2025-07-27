import { auth, type ExtendedUser } from '@/app/(auth)/auth';
import { externalChatService } from '@/lib/api/external-chat-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');
  const messageId = searchParams.get('messageId');

  if (!chatId || !messageId) {
    return Response.json(
      { error: 'chatId and messageId are required' },
      { status: 400 },
    );
  }

  const session = await auth();

  if (!session || !session.user) {
    return Response.json('Unauthorized!', { status: 401 });
  }

  // 检查是否有lcSessionToken
  if (!(session.user as ExtendedUser).lcSessionToken) {
    return Response.json('Missing LC Session Token', { status: 401 });
  }

  try {
    // 如果 chatId 是特殊值 'new'，返回错误
    if (chatId === 'new') {
      return Response.json(
        { error: 'Cannot get metadata for new conversations' },
        { status: 400 },
      );
    }

    // 如果 chatId 是 UUID 格式，返回错误
    if (chatId.includes('-')) {
      return Response.json(
        { error: 'Cannot get metadata for UUID-based conversations' },
        { status: 400 },
      );
    }

    const conversationId = Number.parseInt(chatId);
    if (Number.isNaN(conversationId)) {
      return Response.json(
        { error: 'Invalid conversation ID' },
        { status: 400 },
      );
    }

    // 获取聊天历史来查找对应的消息
    const chatHistoryResponse = await externalChatService.getChatHistory(
      (session.user as ExtendedUser).lcSessionToken as string,
      conversationId,
    );

    // 查找对应的消息
    const targetMessage = chatHistoryResponse.items.find(
      (item) => item.msg_id.toString() === messageId,
    );

    if (!targetMessage) {
      return Response.json({ error: 'Message not found' }, { status: 404 });
    }

    return Response.json({
      conversation_id: conversationId,
      msg_id: targetMessage.msg_id,
    });
  } catch (error) {
    console.error('Failed to get message metadata:', error);
    return Response.json(
      { error: 'Failed to get message metadata' },
      { status: 500 },
    );
  }
}
