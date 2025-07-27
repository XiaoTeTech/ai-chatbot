import type { Message } from 'ai';
import { useSWRConfig } from 'swr';
import { useCopyToClipboard } from 'usehooks-ts';

import type { Vote } from '@/lib/db/schema';

import { CopyIcon, ThumbDownIcon, ThumbUpIcon } from './icons';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { memo } from 'react';
import equal from 'fast-deep-equal';
import { toast } from 'sonner';

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
}: {
  chatId: string;
  message: Message;
  vote: Vote | undefined;
  isLoading: boolean;
}) {
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();

  if (isLoading) return null;
  if (message.role === 'user') return null;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-row gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="py-1 px-2 h-fit text-muted-foreground"
              variant="outline"
              onClick={async () => {
                const textFromParts = message.parts
                  ?.filter((part) => part.type === 'text')
                  .map((part) => part.text)
                  .join('\n')
                  .trim();

                if (!textFromParts) {
                  toast.error("There's no text to copy!");
                  return;
                }

                await copyToClipboard(textFromParts);
                toast.success('已复制到剪贴板！');
              }}
            >
              <CopyIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>复制</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="message-upvote"
              className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto"
              disabled={vote?.isUpvoted}
              variant="outline"
              onClick={async () => {
                const interactionType = vote?.isUpvoted
                  ? 'cancel_praise'
                  : 'add_praise';

                try {
                  // 智能获取 conversation_id 和 msg_id
                  let conversationId: number;
                  let msgId: number;

                  // 检查 message.id 是否包含编码的信息
                  // 格式: "chatcmpl-{uuid}:-{conversation_id}-{msg_id}"
                  if (message.id.includes(':-')) {
                    const parts = message.id.split(':-');
                    if (parts.length === 2) {
                      const idParts = parts[1].split('-');
                      if (idParts.length === 2) {
                        conversationId = Number.parseInt(idParts[0]);
                        msgId = Number.parseInt(idParts[1]);

                        if (
                          Number.isNaN(conversationId) ||
                          Number.isNaN(msgId)
                        ) {
                          toast.error('无法解析消息ID中的元数据');
                          return;
                        }
                        console.log('📋 从消息ID解析得到:', {
                          conversationId,
                          msgId,
                        });
                      } else {
                        toast.error('消息ID格式不正确');
                        return;
                      }
                    } else {
                      toast.error('消息ID格式不正确');
                      return;
                    }
                  } else if (chatId === 'new') {
                    // 新对话但消息没有编码信息，无法投票
                    toast.error('消息信息不完整，请刷新页面后重试');
                    return;
                  } else if (chatId.includes('-')) {
                    // 旧的 UUID 格式，需要获取元数据
                    const metadataResponse = await fetch(
                      `/api/chat/message-metadata?chatId=${chatId}&messageId=${message.id}`,
                    );

                    if (!metadataResponse.ok) {
                      toast.error('无法获取消息元数据，请刷新页面后重试');
                      return;
                    }

                    const metadata = await metadataResponse.json();
                    conversationId = metadata.conversation_id;
                    msgId = metadata.msg_id;
                  } else if (!chatId.includes('-') && chatId !== 'new') {
                    // 数字格式的对话，直接使用 chatId 作为 conversation_id
                    conversationId = Number.parseInt(chatId);

                    if (Number.isNaN(conversationId)) {
                      toast.error('无效的对话ID');
                      return;
                    }

                    // 对于 msg_id，使用时间戳作为临时值（后端会处理）
                    msgId = Date.now();

                    console.log('📋 数字格式对话，使用:', {
                      conversationId,
                      msgId,
                    });
                  } else {
                    // 其他情况：尝试从聊天历史中获取 conversation_id
                    console.log('🔍 尝试从聊天历史获取 conversation_id');

                    try {
                      const historyResponse = await fetch('/api/history');
                      if (historyResponse.ok) {
                        const historyData = await historyResponse.json();

                        // 查找最新的对话
                        if (historyData.length > 0) {
                          const latestConversation = historyData[0];
                          conversationId = latestConversation.id;

                          // 对于 msg_id，我们使用一个临时值
                          msgId = Date.now(); // 临时使用时间戳作为 msg_id

                          console.log('📋 从聊天历史获取到:', {
                            conversationId,
                            msgId,
                          });
                        } else {
                          toast.error('无法获取对话信息，请刷新页面后重试');
                          return;
                        }
                      } else {
                        toast.error('无法获取对话信息，请刷新页面后重试');
                        return;
                      }
                    } catch (error) {
                      console.error('获取聊天历史失败:', error);
                      toast.error('无法获取对话信息，请刷新页面后重试');
                      return;
                    }
                  }

                  const upvote = fetch('/api/chat/interaction', {
                    method: 'POST',
                    body: JSON.stringify({
                      conversation_id: conversationId,
                      msg_id: msgId,
                      interaction_type: interactionType,
                    }),
                  });

                  toast.promise(upvote, {
                    loading: '...',
                    success: () => {
                      mutate<Array<Vote>>(
                        `/api/vote?chatId=${chatId}`,
                        (currentVotes) => {
                          if (!currentVotes) return [];

                          const votesWithoutCurrent = currentVotes.filter(
                            (vote) => vote.messageId !== message.id,
                          );

                          // 根据交互类型更新投票状态
                          if (interactionType === 'cancel_praise') {
                            // 取消点赞，移除投票记录
                            return votesWithoutCurrent;
                          } else {
                            // 添加点赞
                            return [
                              ...votesWithoutCurrent,
                              {
                                chatId,
                                messageId: message.id,
                                isUpvoted: true,
                              },
                            ];
                          }
                        },
                        { revalidate: false },
                      );

                      return '操作成功';
                    },
                    error: '操作失败',
                  });
                } catch (error) {
                  console.error('Vote error:', error);
                  toast.error('投票操作失败');
                }
              }}
            >
              <ThumbUpIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>喜欢</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="message-downvote"
              className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto"
              variant="outline"
              disabled={vote && !vote.isUpvoted}
              onClick={async () => {
                const interactionType =
                  vote && !vote.isUpvoted
                    ? 'cancel_criticism'
                    : 'add_criticism';

                try {
                  // 智能获取 conversation_id 和 msg_id
                  let conversationId: number;
                  let msgId: number;

                  console.log('🔍 投票调试信息:', {
                    chatId,
                    messageId: message.id,
                    hasEncoding: message.id.includes(':-'),
                  });

                  // 优先从 DOM 中查找编码的 ID
                  const messageElement = document.querySelector(
                    `[data-message-id="${message.id}"]`,
                  );
                  const encodedId =
                    messageElement?.getAttribute('data-encoded-id');

                  console.log('🔍 DOM 查找结果:', {
                    messageElement: !!messageElement,
                    encodedId,
                    hasEncodedId: !!encodedId,
                    messageId: message.id,
                  });

                  if (encodedId && encodedId.includes(':-')) {
                    console.log('📋 从 DOM 获取编码 ID:', encodedId);
                    const parts = encodedId.split(':-');
                    if (parts.length === 2) {
                      const idParts = parts[1].split('-');
                      if (idParts.length === 2) {
                        conversationId = Number.parseInt(idParts[0]);
                        msgId = Number.parseInt(idParts[1]);

                        if (
                          Number.isNaN(conversationId) ||
                          Number.isNaN(msgId)
                        ) {
                          toast.error('无法解析DOM中的编码ID');
                          return;
                        }
                        console.log('📋 从DOM解析得到:', {
                          conversationId,
                          msgId,
                        });
                      } else {
                        toast.error('DOM编码ID格式不正确');
                        return;
                      }
                    } else {
                      toast.error('DOM编码ID格式不正确');
                      return;
                    }
                  } else if (message.id.includes(':-')) {
                    // 备用方案：直接从 message.id 解析
                    const parts = message.id.split(':-');
                    if (parts.length === 2) {
                      const idParts = parts[1].split('-');
                      if (idParts.length === 2) {
                        conversationId = Number.parseInt(idParts[0]);
                        msgId = Number.parseInt(idParts[1]);

                        if (
                          Number.isNaN(conversationId) ||
                          Number.isNaN(msgId)
                        ) {
                          toast.error('无法解析消息ID中的元数据');
                          return;
                        }
                        console.log('📋 从消息ID解析得到:', {
                          conversationId,
                          msgId,
                        });
                      } else {
                        toast.error('消息ID格式不正确');
                        return;
                      }
                    } else {
                      toast.error('消息ID格式不正确');
                      return;
                    }
                  } else if (!chatId.includes('-') && chatId !== 'new') {
                    // 数字格式的对话，直接使用 chatId 作为 conversation_id
                    conversationId = Number.parseInt(chatId);

                    if (Number.isNaN(conversationId)) {
                      toast.error('无效的对话ID');
                      return;
                    }

                    // 对于 msg_id，使用时间戳作为临时值（后端会处理）
                    msgId = Date.now();

                    console.log('📋 数字格式对话，使用:', {
                      conversationId,
                      msgId,
                    });
                  } else {
                    // 其他情况：尝试从聊天历史中获取 conversation_id
                    console.log('🔍 尝试从聊天历史获取 conversation_id');

                    try {
                      const historyResponse = await fetch('/api/history');
                      if (historyResponse.ok) {
                        const historyData = await historyResponse.json();

                        // 查找最新的对话
                        if (historyData.length > 0) {
                          const latestConversation = historyData[0];
                          conversationId = latestConversation.id;

                          // 对于 msg_id，我们使用一个临时值或者尝试从消息顺序推断
                          // 这里简化处理，使用消息在当前对话中的索引
                          msgId = Date.now(); // 临时使用时间戳作为 msg_id

                          console.log('📋 从聊天历史获取到:', {
                            conversationId,
                            msgId,
                          });
                        } else {
                          toast.error('无法获取对话信息，请刷新页面后重试');
                          return;
                        }
                      } else {
                        toast.error('无法获取对话信息，请刷新页面后重试');
                        return;
                      }
                    } catch (error) {
                      console.error('获取聊天历史失败:', error);
                      toast.error('无法获取对话信息，请刷新页面后重试');
                      return;
                    }
                  }

                  const downvote = fetch('/api/chat/interaction', {
                    method: 'POST',
                    body: JSON.stringify({
                      conversation_id: conversationId,
                      msg_id: msgId,
                      interaction_type: interactionType,
                    }),
                  });

                  toast.promise(downvote, {
                    loading: '...',
                    success: () => {
                      mutate<Array<Vote>>(
                        `/api/vote?chatId=${chatId}`,
                        (currentVotes) => {
                          if (!currentVotes) return [];

                          const votesWithoutCurrent = currentVotes.filter(
                            (vote) => vote.messageId !== message.id,
                          );

                          // 根据交互类型更新投票状态
                          if (interactionType === 'cancel_criticism') {
                            // 取消踩，移除投票记录
                            return votesWithoutCurrent;
                          } else {
                            // 添加踩
                            return [
                              ...votesWithoutCurrent,
                              {
                                chatId,
                                messageId: message.id,
                                isUpvoted: false,
                              },
                            ];
                          }
                        },
                        { revalidate: false },
                      );

                      return '操作成功';
                    },
                    error: '操作失败',
                  });
                } catch (error) {
                  console.error('Vote error:', error);
                  toast.error('投票操作失败');
                }
              }}
            >
              <ThumbDownIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>不喜欢</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;

    return true;
  },
);
