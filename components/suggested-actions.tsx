'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { memo } from 'react';
import { UseChatHelpers } from '@ai-sdk/react';
import { useSession } from 'next-auth/react';
import { useLoginDialog } from '@/lib/context';
import { LoginDialog } from './login-dialog';

interface SuggestedActionsProps {
  chatId: string;
  append: UseChatHelpers['append'];
}

function PureSuggestedActions({ chatId, append }: SuggestedActionsProps) {
  const { data: session } = useSession();
  const { open } = useLoginDialog();

  const suggestedActions = [
    {
      title: '特斯拉自动驾驶',
      label: '技术原理是什么？',
      action: '特斯拉自动驾驶的技术原理是什么？',
    },
    {
      title: '超级充电站',
      label: '如何查找附近站点？',
      action: '如何查找附近的特斯拉超级充电站？',
    },
    {
      title: '电池续航',
      label: '如何优化使用？',
      action: '特斯拉电池续航如何优化使用？',
    },
    {
      title: '特斯拉新车型',
      label: '最新进展是什么？',
      action: '特斯拉新车型的最新进展是什么？',
    },
  ];

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
        {suggestedActions.map((suggestedAction, index) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.05 * index }}
            key={`suggested-action-${suggestedAction.title}-${index}`}
            className={index > 1 ? 'hidden sm:block' : 'block'}
          >
            <Button
              variant="ghost"
              onClick={() => handleActionClick(suggestedAction.action)}
              className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
            >
              <span className="font-medium">{suggestedAction.title}</span>
              <span className="text-muted-foreground">
                {suggestedAction.label}
              </span>
            </Button>
          </motion.div>
        ))}
      </div>
      <LoginDialog />
    </>
  );
}

export const SuggestedActions = memo(PureSuggestedActions, () => true);