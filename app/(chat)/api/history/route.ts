import { auth } from '@/app/(auth)/auth';
import { externalChatService } from '@/lib/api/external-chat-service';
import { transformConversationsToChats } from '@/lib/api/data-transformers';

export async function GET() {
  const session = await auth();

  if (!session || !session.user) {
    return Response.json('Unauthorized!', { status: 401 });
  }

  // 检查是否有lcSessionToken
  if (!session.user.lcSessionToken) {
    return Response.json('Missing LC Session Token', { status: 401 });
  }

  try {
    // 调用外部API获取对话列表
    const conversationsResponse = await externalChatService.getConversations(
      session.user.lcSessionToken,
      1, // 第一页
      100, // 获取更多数据，前端会处理分页显示
    );

    // 转换数据格式
    const chats = transformConversationsToChats(conversationsResponse);

    return Response.json(chats);
  } catch (error) {
    console.error('Failed to fetch conversations from external API:', error);
    return Response.json('Failed to fetch conversations', { status: 500 });
  }
}
