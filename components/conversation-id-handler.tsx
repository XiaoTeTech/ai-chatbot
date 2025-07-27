'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ConversationIdHandlerProps {
  chatId: string;
}

export function ConversationIdHandler({ chatId }: ConversationIdHandlerProps) {
  const { data } = useChat({ id: chatId });
  const router = useRouter();

  useEffect(() => {
    if (data && Array.isArray(data)) {
      // 查找 conversation_id 类型的数据
      const conversationIdData = data.find(
        (item: any) => 
          item && 
          typeof item === 'object' && 
          'type' in item && 
          item.type === 'conversation_id'
      );

      if (conversationIdData && 'content' in conversationIdData) {
        const realConversationId = conversationIdData.content;
        console.log('🆔 Received real conversation ID:', realConversationId);

        // 如果当前 URL 中的 ID 不是真实的 conversation_id，则更新 URL
        if (chatId !== realConversationId.toString()) {
          console.log(`🔄 Updating URL from /chat/${chatId} to /chat/${realConversationId}`);
          router.replace(`/chat/${realConversationId}`);
        }
      }
    }
  }, [data, chatId, router]);

  return null; // 这是一个无渲染组件
}
