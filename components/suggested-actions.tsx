'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { memo, useState, useEffect } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import { useSession } from 'next-auth/react';
import { useLoginDialog } from '@/lib/context';
import { LoginDialog } from './login-dialog';
import { suggestedActions } from '@/lib/suggested-actions-data';
import { useAppConfig } from '@/hooks/use-app-config';

interface SuggestedActionsProps {
  chatId: string;
  append: UseChatHelpers['append'];
}

function PureSuggestedActions({ append, chatId }: SuggestedActionsProps) {
  const { data: session } = useSession();
  const { open } = useLoginDialog();
  const { appConfig } = useAppConfig();
  const [displayedActions, setDisplayedActions] = useState<string[]>([]);

  useEffect(() => {
    if (appConfig?.chat_suggestions && appConfig.chat_suggestions.length > 0) {
      setDisplayedActions(appConfig.chat_suggestions);
    } else {
      // 如果 API 没有返回建议，使用本地数据作为后备
      const getRandomActions = () => {
        const shuffled = [...suggestedActions].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 4).map((action) => action.action);
      };
      setDisplayedActions(getRandomActions());
    }
  }, [appConfig]);

  const handleActionClick = async (action: string) => {
    if (!session?.user) {
      open();
      return;
    }

    // 直接发送消息，让系统自动处理 conversation_id 的更新
    append({
      role: 'user',
      content: action,
    });
  };

  return (
    <>
      <div
        data-testid="suggested-actions"
        className="grid sm:grid-cols-2 gap-2 w-full"
      >
        {displayedActions.map((action, index) => (
          <motion.div
            key={action}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.05 * index }}
            className={index > 1 ? 'hidden sm:block' : 'block'}
          >
            <Button
              variant="ghost"
              onClick={() => handleActionClick(action)}
              className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 w-full h-auto justify-start items-start"
            >
              <span className="font-medium">{action}</span>
            </Button>
          </motion.div>
        ))}
      </div>
      <LoginDialog />
    </>
  );
}

export const SuggestedActions = memo(PureSuggestedActions);
