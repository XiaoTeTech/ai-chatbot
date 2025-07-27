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

// 高仿原版的消息显示组件
function BeautifulMessages({
  messages,
  isLoading,
}: {
  messages: SimpleUIMessage[];
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4">
      {messages.length === 0 && (
        <div className="mx-auto max-w-3xl px-4">
          <div className="flex flex-col gap-4 text-center">
            <h1 className="text-2xl font-semibold">欢迎使用 AI 助手</h1>
            <p className="text-muted-foreground">开始对话吧！</p>
          </div>
        </div>
      )}

      {messages.map((message, index) => (
        <div
          key={message.id}
          className="w-full mx-auto max-w-3xl px-4 group/message"
          data-role={message.role}
        >
          <div
            className={`flex gap-4 ${
              message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {message.role === 'user' ? 'U' : 'AI'}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={`prose prose-sm max-w-none ${
                  message.role === 'user' ? 'text-right' : 'text-left'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                  {isLoading &&
                    index === messages.length - 1 &&
                    message.role === 'assistant' && (
                      <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {isLoading &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && (
          <div className="w-full mx-auto max-w-3xl px-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-sm font-medium">
                AI
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="flex gap-1">
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                  <span className="text-sm">正在思考...</span>
                </div>
              </div>
            </div>
          </div>
        )}

      <div className="shrink-0 min-w-[24px] min-h-[24px]" />
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
        <BeautifulMessages messages={messages} isLoading={isLoading} />
        <form
          onSubmit={handleSubmit}
          className="mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl"
        >
          <div className="relative flex items-end gap-2 p-2 border border-input rounded-xl bg-background focus-within:border-ring">
            <div className="flex-1 min-h-[44px] flex items-center">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="输入消息... (Shift+Enter 换行)"
                disabled={isLoading}
                rows={1}
                className="w-full resize-none border-0 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  minHeight: '44px',
                  maxHeight: '200px',
                  height: 'auto',
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                }}
              />
            </div>

            <div className="flex gap-1">
              {isLoading ? (
                <button
                  type="button"
                  onClick={stop}
                  className="inline-flex items-center justify-center rounded-lg w-8 h-8 bg-red-500 text-white hover:bg-red-600 transition-colors"
                  title="停止生成"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="inline-flex items-center justify-center rounded-lg w-8 h-8 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="发送消息"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <div className="flex gap-1">
                <div
                  className="w-1 h-1 bg-current rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <div
                  className="w-1 h-1 bg-current rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="w-1 h-1 bg-current rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
              <span>AI 正在回复...</span>
            </div>
          )}
        </form>
      </div>
    </>
  );
}
