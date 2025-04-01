import {
  type UIMessage,
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  getTrailingMessageId,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';

export const maxDuration = 60;

// 所有建议操作的内容列表
const SUGGESTED_ACTIONS = [
  '特斯拉自动驾驶的技术原理是什么？',
  '如何查找附近的特斯拉超级充电站？',
  '特斯拉电池续航如何优化使用？',
  '特斯拉新车型的最新进展是什么？',
  '特斯拉日常保养和维护需要注意哪些事项？',
  '特斯拉保险如何选择最合适的方案？',
  '特斯拉家用充电桩如何安装和使用？',
  '特斯拉最新的OTA系统更新带来了哪些新功能？',
  '特斯拉有哪些重要的安全功能？',
  '特斯拉最新价格和优惠政策是什么？',
  '特斯拉内饰材质有哪些，如何正确清洁？',
  '特斯拉的加速和操控性能表现如何？',
  '特斯拉露营模式如何使用，需要注意什么？',
  '特斯拉宠物模式有什么功能，如何使用？',
  '特斯拉哨兵模式如何设置和使用？',
  '特斯拉导航系统有哪些特色功能？',
  '特斯拉音响系统如何调教才能获得最佳音效？',
  '特斯拉座椅如何调节才能获得最佳舒适度？',
  '特斯拉空调系统如何设置最节能？',
  '特斯拉雨刮器如何正确使用和维护？',
  '特斯拉轮胎如何选择和更换？',
  '特斯拉玻璃如何清洁和保养？',
  '特斯拉车漆如何保养和维护？',
  '特斯拉轮毂如何清洁和保养？',
  '特斯拉车灯如何正确使用和维护？',
  '特斯拉钥匙如何配对和使用？',
  '特斯拉APP有哪些实用功能？',
  '特斯拉紧急救援服务如何使用？',
  '特斯拉改装需要注意哪些事项？',
  '特斯拉二手车如何选购？',
  '特斯拉租赁方案有哪些，如何选择？'
];

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel,
    }: {
      id: string;
      messages: Array<UIMessage>;
      selectedChatModel: string;
    } = await request.json();

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    // 检查最新的用户消息是否匹配建议操作列表
    const messageContent = typeof userMessage.content === 'string' 
      ? userMessage.content 
      : '';
        
    const isSuggestedAction = SUGGESTED_ACTIONS.includes(messageContent);

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message: userMessage,
      });

      await saveChat({ id, userId: session.user.id, title });
    } else {
      if (chat.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: userMessage.id,
          role: 'user',
          parts: userMessage.parts,
          attachments: userMessage.experimental_attachments ?? [],
          createdAt: new Date(),
        },
      ],
    });

    return createDataStreamResponse({
      execute: async (dataStream) => {
        const result = streamText({
          // 如果是建议操作，使用 suggest-model，否则使用用户选择的模型
          model: (await myProvider()).languageModel(isSuggestedAction ? "suggested-model" : selectedChatModel),
          system: systemPrompt({ selectedChatModel }),
          messages,
          maxSteps: 5,
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_generateMessageId: generateUUID,
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          onFinish: async ({ response }) => {
            if (session.user?.id) {
              try {
                const assistantId = getTrailingMessageId({
                  messages: response.messages.filter(
                    (message) => message.role === 'assistant',
                  ),
                });

                if (!assistantId) {
                  throw new Error('No assistant message found!');
                }

                const [, assistantMessage] = appendResponseMessages({
                  messages: [userMessage],
                  responseMessages: response.messages,
                });

                await saveMessages({
                  messages: [
                    {
                      id: assistantId,
                      chatId: id,
                      role: assistantMessage.role,
                      parts: assistantMessage.parts,
                      attachments:
                        assistantMessage.experimental_attachments ?? [],
                      createdAt: new Date(),
                    },
                  ],
                });
              } catch (_) {
                console.error('Failed to save chat');
              }
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: (error) => {
        console.error(error);
        return 'Oops, 发生错误';
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

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('处理您的请求时出现了错误！', {
      status: 500,
    });
  }
}
