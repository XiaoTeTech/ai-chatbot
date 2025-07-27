import { auth } from '@/app/(auth)/auth';
import { externalChatService } from '@/lib/api/external-chat-service';

// 简单的内存存储
const conversationMap = new Map<string, number>();

export const maxDuration = 60;

export async function POST(request: Request) {
  const { messages, id, selectedChatModel } = await request.json();

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 检查是否有lcSessionToken
  if (!(session.user as any).lcSessionToken) {
    return new Response('Missing LC Session Token', { status: 401 });
  }

  try {
    console.log('🚀 Starting simple chat...');
    console.log('🆔 Chat ID:', id);

    // 转换消息格式
    const apiMessages = messages.map((msg: any) => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : '',
    }));

    // 判断是否为新对话
    const isNewConversation = id.includes('-');
    const conversationId = isNewConversation ? null : Number.parseInt(id);

    // 调用外部聊天API
    const streamResponse = await externalChatService.chatCompletionStream(
      (session.user as any).lcSessionToken,
      {
        messages: apiMessages,
        model: selectedChatModel,
        stream: true,
        temperature: 0.5,
        max_tokens: 4000,
        conversation_id: conversationId,
        from_web: true,
      },
    );

    let extractedConversationId: number | null = null;

    // 创建简单的流式响应
    const stream = new ReadableStream({
      async start(controller) {
        const reader = streamResponse.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (!line.trim() || !line.startsWith('data: ')) continue;

              const jsonStr = line.slice(6);
              if (jsonStr.trim() === '[DONE]') break;

              try {
                const data = JSON.parse(jsonStr);
                
                // 提取 conversation_id
                if (data.id && !extractedConversationId) {
                  console.log('🔍 检查 ID:', data.id);
                  
                  // 尝试从不同格式中提取
                  if (data.id.includes(':')) {
                    const parts = data.id.split(':');
                    const lastPart = parts[parts.length - 1];
                    const cleanPart = lastPart.startsWith('-') ? lastPart.substring(1) : lastPart;
                    const convPart = cleanPart.split('-')[0];
                    if (!isNaN(Number(convPart))) {
                      extractedConversationId = Number(convPart);
                      console.log('🆔 提取到 conversation_id:', extractedConversationId);
                      // 保存到内存
                      conversationMap.set(id, extractedConversationId);
                    }
                  }
                }

                // 提取内容并直接发送
                if (data.choices?.[0]?.delta?.content) {
                  const content = data.choices[0].delta.content;
                  
                  // 直接发送文本内容
                  controller.enqueue(encoder.encode(content));
                }
              } catch (e) {
                console.warn('解析数据失败:', e);
              }
            }
          }
        } catch (error) {
          console.error('流处理错误:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error(error);
    return new Response('处理请求时出现错误', { status: 500 });
  }
}

// 获取 conversation_id 的 API
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tempId = searchParams.get('tempId');

  if (!tempId) {
    return new Response('tempId is required', { status: 400 });
  }

  const conversationId = conversationMap.get(tempId);
  
  return Response.json({ 
    conversationId: conversationId || null 
  });
}
