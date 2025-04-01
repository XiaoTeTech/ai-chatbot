'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { memo, useState, useEffect } from 'react';
import { UseChatHelpers } from '@ai-sdk/react';
import { useSession } from 'next-auth/react';
import { useLoginDialog } from '@/lib/context';
import { LoginDialog } from './login-dialog';
import { suggestedActions } from '@/lib/suggested-actions-data';

interface SuggestedActionsProps {
  chatId: string;
  append: UseChatHelpers['append'];
}

function PureSuggestedActions({ append, chatId }: SuggestedActionsProps) {
  const { data: session } = useSession();
  const { open } = useLoginDialog();
  const [displayedActions, setDisplayedActions] = useState<typeof suggestedActions>([]);

  useEffect(() => {
    // 只在客户端执行随机选择
    const getRandomActions = () => {
      const shuffled = [...suggestedActions].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 4);
    };

    setDisplayedActions(getRandomActions());

    // 每5分钟更新一次显示的问题
    const interval = setInterval(() => {
      setDisplayedActions(getRandomActions());
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleActionClick = async (action: string) => {
    if (!session?.user) {
      open();
      return;
    }

    window.history.replaceState({}, '', `/chat/${chatId}`);
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
            key={action.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.05 * index }}
            className={index > 1 ? 'hidden sm:block' : 'block'}
          >
            <Button
              variant="ghost"
              onClick={() => handleActionClick(action.action)}
              className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
            >
              <span className="font-medium">{action.title}</span>
              <span className="text-muted-foreground">
                {action.label}
              </span>
            </Button>
          </motion.div>
        ))}
      </div>
      <LoginDialog />
    </>
  );
}

export const SuggestedActions = memo(PureSuggestedActions);