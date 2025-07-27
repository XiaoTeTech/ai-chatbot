'use client';

import { useState, useRef } from 'react';
import { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import { VisibilityType } from './visibility-selector';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { useLoginDialog } from '@/lib/context';
import { useRouter } from 'next/navigation';
// 自定义消息类型
type SimpleUIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date;
};

// 简单的消息显示组件
function SimpleMessages({
  messages,
  isLoading,
}: {
  messages: SimpleUIMessage[];
  isLoading: boolean;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
        >
          <div
            className={`inline-block p-3 rounded-lg max-w-[80%] ${
              message.role === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}
          >
            {typeof message.content === 'string' ? message.content : ''}
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="text-left mb-4">
          <div className="inline-block p-3 rounded-lg bg-gray-100">
            <div className="animate-pulse">正在思考...</div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ChatProps {
  id: string;
  initialMessages: Array<SimpleUIMessage>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}

export function Chat({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
}: ChatProps) {
  const { data: session } = useSession();
  const { open: openLoginDialog } = useLoginDialog();
  const router = useRouter();
  const { mutate } = useSWRConfig();

  const [messages, setMessages] = useState<SimpleUIMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user) {
      openLoginDialog();
      return;
    }

    if (!input.trim() || isLoading) {
      if (isLoading) {
        toast.error('请等待模型完成回复！');
      }
      return;
    }

    const userMessage: SimpleUIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      createdAt: new Date(),
    };

    const assistantMessage: SimpleUIMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          id,
          selectedChatModel,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // 更新助手消息内容 - 添加打字效果
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === 'assistant') {
            lastMessage.content += chunk;
          }
          return newMessages;
        });

        // 添加小延迟以产生打字效果
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // 检查是否需要跳转到新的 conversation_id
      if (id === 'new' || id.includes('-')) {
        // 尝试获取真实的 conversation_id
        try {
          const convResponse = await fetch(`/api/chat?tempId=${id}`);
          const convData = await convResponse.json();

          if (convData.conversationId) {
            console.log('🔄 跳转到真实对话:', convData.conversationId);
            router.replace(`/chat/${convData.conversationId}`);
          }
        } catch (error) {
          console.warn('获取 conversation_id 失败:', error);
        }
      }

      // 刷新历史记录
      mutate('/api/history');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('请求被取消');
        return;
      }

      console.error('聊天错误:', error);
      toast.error('出问题啦，请再试一次！');

      // 移除失败的消息
      setMessages((prev) => prev.slice(0, -2));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const reload = () => {
    // 重新发送最后一条用户消息
    const lastUserMessage = messages.findLast((m) => m.role === 'user');
    if (lastUserMessage) {
      setInput(lastUserMessage.content);
      // 移除最后的助手回复
      setMessages((prev) => {
        const newMessages = [...prev];
        if (newMessages[newMessages.length - 1]?.role === 'assistant') {
          newMessages.pop();
        }
        return newMessages;
      });
    }
  };

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedVisibilityType={selectedVisibilityType}
          isReadonly={isReadonly}
        />
        <SimpleMessages messages={messages} isLoading={isLoading} />
        <form
          onSubmit={handleSubmit}
          className="mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入消息..."
              disabled={isLoading}
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '发送中...' : '发送'}
            </button>
            {isLoading && (
              <button
                type="button"
                onClick={stop}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                停止
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
