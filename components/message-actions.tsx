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
                // 检查是否为 UUID 格式的 chatId
                if (chatId.includes('-')) {
                  toast.error('无法在新对话中进行投票操作');
                  return;
                }

                const interactionType = vote?.isUpvoted
                  ? 'cancel_praise'
                  : 'add_praise';

                const upvote = fetch('/api/chat/interaction', {
                  method: 'POST',
                  body: JSON.stringify({
                    conversation_id: Number.parseInt(chatId),
                    msg_id: Number.parseInt(message.id),
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
                // 检查是否为 UUID 格式的 chatId
                if (chatId.includes('-')) {
                  toast.error('无法在新对话中进行投票操作');
                  return;
                }

                const interactionType =
                  vote && !vote.isUpvoted
                    ? 'cancel_criticism'
                    : 'add_criticism';

                const downvote = fetch('/api/chat/interaction', {
                  method: 'POST',
                  body: JSON.stringify({
                    conversation_id: Number.parseInt(chatId),
                    msg_id: Number.parseInt(message.id),
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
