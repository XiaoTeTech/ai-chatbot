import type { UIMessage } from 'ai';
import { auth } from '@/app/(auth)/auth';
import { externalChatService } from '@/lib/api/external-chat-service';
import { getMostRecentUserMessage } from '@/lib/utils';
import { suggestedActions } from '@/lib/suggested-actions-data';

// 提取建议操作的文本内容用于匹配
const SUGGESTED_ACTION_TEXTS = suggestedActions.map((action) => action.action);

export const maxDuration = 60;

export async function POST(request: Request) {
  console.log('🚀 POST /api/chat - Request received');

  try {
    const requestBody = await request.json();
    console.log('📝 Request body:', JSON.stringify(requestBody, null, 2));

    const {
      id,
      messages,
      selectedChatModel,
    }: {
      id: string;
      messages: Array<UIMessage>;
      selectedChatModel: string;
    } = requestBody;

    console.log(
      '🔍 Parsed request - ID:',
      id,
      'Messages count:',
      messages?.length,
      'Model:',
      selectedChatModel,
    );

    const session = await auth();
    console.log(
      '👤 Session check - User ID:',
      session?.user?.id,
      'Has lcSessionToken:',
      !!session?.user?.lcSessionToken,
    );

    if (!session || !session.user || !session.user.id) {
      console.log('❌ Unauthorized - No session or user');
      return new Response('Unauthorized', { status: 401 });
    }

    // 检查是否有lcSessionToken
    if (!session.user.lcSessionToken) {
      console.log('❌ Missing LC Session Token');
      return new Response('Missing LC Session Token', { status: 401 });
    }

    // 调试日志（生产环境中应该移除）
    // console.log('LLM Chat Request - User ID:', session.user.id);
    // console.log(
    //   'LLM Chat Request - LC Session Token:',
    //   session.user.lcSessionToken?.substring(0, 10) + '...',
    // );

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    // 检查最新的用户消息是否匹配建议操作列表
    console.log(userMessage.content);
    const messageContent =
      typeof userMessage.content === 'string' ? userMessage.content : '';

    const isSuggestedAction = SUGGESTED_ACTION_TEXTS.includes(messageContent);

    // 转换消息格式为外部API格式
    const externalMessages = messages.map((msg) => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : '',
    }));

    // 确定使用的模型 - 根据Python示例使用gpt-3.5-turbo
    const modelName = isSuggestedAction ? 'gpt-3.5-turbo' : 'gpt-3.5-turbo';

    console.log('🎯 Starting LLM API call with model:', modelName);
    console.log(
      '💬 External messages:',
      JSON.stringify(externalMessages, null, 2),
    );

    console.log('🔄 Calling external LLM API...');

    // 调用外部LLM API进行流式聊天
    const streamResponse = await externalChatService.chatCompletionStream(
      session.user.lcSessionToken,
      {
        model: modelName,
        messages: externalMessages,
        stream: true,
        conversation_id: id,
      },
    );

    console.log('✅ Got stream response from external API');
    console.log('🔍 Stream response type:', typeof streamResponse);
    console.log(
      '🔍 Stream response constructor:',
      streamResponse.constructor.name,
    );
    console.log('🔍 Stream response properties:', Object.keys(streamResponse));

    // 先读取一些数据来检查外部API的实际格式
    console.log('🔍 Sampling external API stream data...');
    const reader = streamResponse.getReader();
    const decoder = new TextDecoder();
    let sampleData = '';
    let sampleCount = 0;

    try {
      // 读取前几个chunks来检查格式
      while (sampleCount < 3) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('🔚 Stream ended during sampling');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        sampleData += chunk;
        sampleCount++;

        console.log(`📦 Sample chunk ${sampleCount}:`, chunk);
      }

      console.log('📋 Complete sample data:', sampleData);
    } catch (error) {
      console.error('❌ Error sampling stream:', error);
    }

    // 由于我们已经读取了部分数据，流已经被消费了
    // 我们需要重新调用外部API来获取新的流
    console.log('🔄 Re-calling external API for fresh stream...');
    const freshStreamResponse = await externalChatService.chatCompletionStream(
      session.user.lcSessionToken,
      {
        model: modelName,
        messages: externalMessages,
        stream: true,
        conversation_id: id,
      },
    );

    // 直接返回新的流
    return new Response(freshStreamResponse, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });

    // 创建一个转换流，将外部API的流式响应转换为前端期望的格式
    const transformedStream = new ReadableStream({
      async start(controller) {
        console.log('🚀 Starting stream transformation...');

        let reader;
        try {
          reader = streamResponse.getReader();
          console.log('✅ Got stream reader');
        } catch (error) {
          console.error('❌ Failed to get stream reader:', error);
          controller.error(error);
          return;
        }

        const decoder = new TextDecoder();
        let chunkCount = 0;

        try {
          while (true) {
            console.log(`🔄 Reading chunk ${chunkCount + 1}...`);
            const { done, value } = await reader.read();

            console.log('📊 Read result:', {
              done,
              valueLength: value?.length,
            });

            if (done) {
              console.log('🏁 Stream finished, total chunks:', chunkCount);
              break;
            }

            chunkCount++;
            const chunk = decoder.decode(value, { stream: true });
            console.log(`📦 Chunk ${chunkCount}:`, chunk.substring(0, 200));

            const lines = chunk.split('\n');
            console.log(`📋 Lines in chunk:`, lines);

            for (const line of lines) {
              console.log(`🔍 Processing line:`, line);
              if (line.startsWith('data:') && !line.includes('[DONE]')) {
                try {
                  const jsonStr = line.substring(5).trim();
                  if (jsonStr) {
                    const data = JSON.parse(jsonStr);

                    // 提取消息内容
                    if (data.choices?.[0]?.delta?.content) {
                      const content = data.choices[0].delta.content;
                      console.log('📝 Writing content:', content);

                      // 直接转发原始的流式数据，保持OpenAI兼容格式
                      controller.enqueue(new TextEncoder().encode(line + '\n'));
                    }
                  }
                } catch (e) {
                  console.warn('⚠️ Failed to parse streaming data:', line, e);
                }
              }
            }
          }
        } catch (error) {
          console.error('💥 Stream processing error:', error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(transformedStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error(error);
    return new Response('处理您的请求时出现了错误！', {
      status: 404,
    });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
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
    const conversationId = Number.parseInt(id);
    if (Number.isNaN(conversationId)) {
      return new Response('Invalid conversation ID', { status: 400 });
    }

    // 调用外部API删除对话
    await externalChatService.deleteConversation(
      session.user.lcSessionToken,
      conversationId,
    );

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    return new Response('处理您的请求时出现了错误！', {
      status: 500,
    });
  }
}
