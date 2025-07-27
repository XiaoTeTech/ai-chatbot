import { auth } from '@/app/(auth)/auth';
import { externalChatService } from '@/lib/api/external-chat-service';

export async function POST(request: Request) {
  const session = await auth();

  if (!session || !session.user) {
    return Response.json('Unauthorized!', { status: 401 });
  }

  // 检查是否有lcSessionToken
  if (!session.user.lcSessionToken) {
    return Response.json('Missing LC Session Token', { status: 401 });
  }

  try {
    const body = await request.json();
    const { conversation_id, msg_id, interaction_type } = body;

    // 验证必需参数
    if (!conversation_id || !msg_id || !interaction_type) {
      return Response.json(
        { error: 'Missing required parameters: conversation_id, msg_id, interaction_type' },
        { status: 400 }
      );
    }

    // 验证交互类型
    const validInteractionTypes = ['add_praise', 'cancel_praise', 'add_criticism', 'cancel_criticism'];
    if (!validInteractionTypes.includes(interaction_type)) {
      return Response.json(
        { error: 'Invalid interaction_type. Must be one of: ' + validInteractionTypes.join(', ') },
        { status: 400 }
      );
    }

    // 调用外部API进行交互
    const result = await externalChatService.interactWithMessage(
      session.user.lcSessionToken,
      {
        conversation_id: Number(conversation_id),
        msg_id: Number(msg_id),
        interaction_type,
      }
    );

    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error('Failed to interact with message:', error);
    return Response.json(
      { error: 'Failed to interact with message' },
      { status: 500 }
    );
  }
}
