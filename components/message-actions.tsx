import type { Message } from 'ai';
import { memo } from 'react';

export function PureMessageActions({
  chatId,
  message,
  isLoading,
}: {
  chatId: string;
  message: Message;
  isLoading: boolean;
}) {
  // 返回空内容，移除所有按钮
  return null;
}

export const MessageActions = memo(PureMessageActions);
