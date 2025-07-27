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

                  if (chatId.includes('-')) {
                    // UUID 格式，需要获取元数据
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
                  } else {
                    // 数字格式，直接使用
                    conversationId = Number.parseInt(chatId);
                    msgId = Number.parseInt(message.id);

                    if (Number.isNaN(conversationId) || Number.isNaN(msgId)) {
                      toast.error('无效的对话或消息ID');
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

                  if (chatId.includes('-')) {
                    // UUID 格式，需要获取元数据
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
                  } else {
                    // 数字格式，直接使用
                    conversationId = Number.parseInt(chatId);
                    msgId = Number.parseInt(message.id);

                    if (Number.isNaN(conversationId) || Number.isNaN(msgId)) {
                      toast.error('无效的对话或消息ID');
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
