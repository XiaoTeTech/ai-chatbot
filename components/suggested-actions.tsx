'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { memo, useState, useEffect } from 'react';
import { UseChatHelpers } from '@ai-sdk/react';
import { useSession } from 'next-auth/react';
import { useLoginDialog } from '@/lib/context';
import { LoginDialog } from './login-dialog';

interface SuggestedActionsProps {
  chatId: string;
  append: UseChatHelpers['append'];
}

function PureSuggestedActions({ append, chatId }: SuggestedActionsProps) {
  const { data: session } = useSession();
  const { open } = useLoginDialog();
  const [displayedActions, setDisplayedActions] = useState<typeof suggestedActions>([]);

  const suggestedActions = [
    {
      title: '自动驾驶',
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
      title: '新车型',
      label: '最新进展是什么？',
      action: '特斯拉新车型的最新进展是什么？',
    },
    {
      title: '日常保养',
      label: '维护需要注意什么？',
      action: '特斯拉日常保养和维护需要注意哪些事项？',
    },
    {
      title: '保险方案',
      label: '如何选择最合适的保险？',
      action: '特斯拉保险如何选择最合适的方案？',
    },
    {
      title: '家用充电',
      label: '充电桩安装指南',
      action: '特斯拉家用充电桩如何安装和使用？',
    },
    {
      title: '系统更新',
      label: 'OTA有什么新功能？',
      action: '特斯拉最新的OTA系统更新带来了哪些新功能？',
    },
    {
      title: '安全功能',
      label: '有哪些重要功能？',
      action: '特斯拉有哪些重要的安全功能？',
    },
    {
      title: '价格优惠',
      label: '最新价格和优惠政策',
      action: '特斯拉最新价格和优惠政策是什么？',
    },
    {
      title: '内饰清洁',
      label: '材质和清洁方法',
      action: '特斯拉内饰材质有哪些，如何正确清洁？',
    },
    {
      title: '性能表现',
      label: '加速和操控性能如何？',
      action: '特斯拉的加速和操控性能表现如何？',
    },
    {
      title: '露营模式',
      label: '使用指南',
      action: '特斯拉露营模式如何使用，需要注意什么？',
    },
    {
      title: '宠物模式',
      label: '功能介绍',
      action: '特斯拉宠物模式有什么功能，如何使用？',
    },
    {
      title: '哨兵模式',
      label: '使用技巧',
      action: '特斯拉哨兵模式如何设置和使用？',
    },
    {
      title: '导航系统',
      label: '使用指南',
      action: '特斯拉导航系统有哪些特色功能？',
    },
    {
      title: '音响系统',
      label: '调教方法',
      action: '特斯拉音响系统如何调教才能获得最佳音效？',
    },
    {
      title: '座椅调节',
      label: '舒适度设置',
      action: '特斯拉座椅如何调节才能获得最佳舒适度？',
    },
    {
      title: '空调系统',
      label: '使用技巧',
      action: '特斯拉空调系统如何设置最节能？',
    },
    {
      title: '雨刮器',
      label: '使用和维护',
      action: '特斯拉雨刮器如何正确使用和维护？',
    },
    {
      title: '轮胎选择',
      label: '更换指南',
      action: '特斯拉轮胎如何选择和更换？',
    },
    {
      title: '玻璃保养',
      label: '清洁方法',
      action: '特斯拉玻璃如何清洁和保养？',
    },
    {
      title: '车漆保养',
      label: '维护方法',
      action: '特斯拉车漆如何保养和维护？',
    },
    {
      title: '轮毂保养',
      label: '清洁方法',
      action: '特斯拉轮毂如何清洁和保养？',
    },
    {
      title: '车灯使用',
      label: '维护指南',
      action: '特斯拉车灯如何正确使用和维护？',
    },
    {
      title: '钥匙配对',
      label: '使用指南',
      action: '特斯拉钥匙如何配对和使用？',
    },
    {
      title: 'APP功能',
      label: '使用指南',
      action: '特斯拉APP有哪些实用功能？',
    },
    {
      title: '紧急救援',
      label: '服务指南',
      action: '特斯拉紧急救援服务如何使用？',
    },
    {
      title: '改装指南',
      label: '注意事项',
      action: '特斯拉改装需要注意哪些事项？',
    },
    {
      title: '二手车',
      label: '选购指南',
      action: '特斯拉二手车如何选购？',
    },
    {
      title: '租赁方案',
      label: '选择指南',
      action: '特斯拉租赁方案有哪些，如何选择？',
    }
  ];

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