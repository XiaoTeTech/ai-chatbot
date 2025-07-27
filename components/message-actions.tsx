import type { Message } from 'ai';
import { useCopyToClipboard } from 'usehooks-ts';
import { memo } from 'react';

import { CopyIcon } from './icons';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { toast } from 'sonner';

export function PureMessageActions({
  chatId,
  message,
  isLoading,
}: {
  chatId: string;
  message: Message;
  isLoading: boolean;
}) {
  const [_, copyToClipboard] = useCopyToClipboard();

  if (isLoading) {
    return null;
  }

  if (message.role === 'user') {
    return null;
  }

  return (
    <TooltipProvider delayDuration={1000}>
      <div className="flex flex-row gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto"
              variant="outline"
              onClick={async () => {
                const textFromParts = message.content
                  .map((part) => {
                    if (part.type === 'text') {
                      return part.text;
                    }
                    return '';
                  })
                  .join('');

                await copyToClipboard(textFromParts);
                toast.success('已复制到剪贴板！');
              }}
            >
              <CopyIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>复制</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export const MessageActions = memo(PureMessageActions);
