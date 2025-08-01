'use client';

import { useState, useRef } from 'react';
import { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import { VisibilityType } from './visibility-selector';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { useLoginDialog } from '@/lib/context';
import { useRouter } from 'next/navigation';
import { useAppConfig } from '@/lib/hooks/use-app-config';
import { Markdown } from './markdown';
// 自定义消息类型
type SimpleUIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date;
  vote_status?: 'praise' | 'criticism' | null;
};

// Loading动画组件
function LoadingIndicator({
  type = 'dots',
}: { type?: 'dots' | 'spinner' | 'pulse' }) {
  if (type === 'spinner') {
    return (
      <svg
        className="animate-spin h-4 w-4 text-muted-foreground/60"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );
  }

  if (type === 'pulse') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-1 h-4 bg-muted-foreground/60 animate-pulse rounded-full" />
        <span className="text-sm text-muted-foreground/60 animate-pulse">
          AI正在思考...
        </span>
      </div>
    );
  }

  // 默认dots动画
  return (
    <div className="flex gap-1">
      <div
        className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"
        style={{
          animationDelay: '0ms',
          animationDuration: '1.4s',
        }}
      />
      <div
        className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"
        style={{
          animationDelay: '0.2s',
          animationDuration: '1.4s',
        }}
      />
      <div
        className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"
        style={{
          animationDelay: '0.4s',
          animationDuration: '1.4s',
        }}
      />
    </div>
  );
}

// 精确还原原版UI的消息显示组件
function BeautifulMessages({
  messages,
  isLoading,
  onCopyMessage,
  onVoteMessage,
  onSuggestionClick,
  session,
}: {
  messages: SimpleUIMessage[];
  isLoading: boolean;
  onCopyMessage: (content: string) => void;
  onVoteMessage: (messageId: string, voteType: 'up' | 'down') => void;
  onSuggestionClick: (suggestion: string) => void;
  session: any;
}) {
  const { config } = useAppConfig();

  // 默认配置，用于未登录用户
  const defaultConfig = {
    chat_introduction:
      '嘿，我是小特AI！随时为你解惑，点燃生活✨与工作💼的灵感火花💡。有什么想聊的？',
    chat_suggestions: [
      '特斯拉股价今天表现如何？',
      '最近有哪些AI技术突破？',
      '今天的电动车新闻有哪些？',
      '帮我分析一下今天的市场趋势',
    ],
  };

  // 使用配置或默认配置
  const currentConfig = config || defaultConfig;

  return (
    <div className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4">
      {messages.length === 0 && (
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="flex flex-col items-center gap-12">
            {/* 问候语 */}
            <div className="text-center">
              <h1 className="text-4xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                晚上好，{session?.user?.name || '朋友'}！
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 font-normal">
                {currentConfig.chat_introduction}
              </p>
            </div>

            {/* 建议卡片 */}
            {currentConfig.chat_suggestions &&
              currentConfig.chat_suggestions.length > 0 && (
                <div className="w-full max-w-2xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentConfig.chat_suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => onSuggestionClick(suggestion)}
                        className="group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-left hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        <div className="flex flex-col">
                          <h3 className="font-medium text-gray-900 dark:text-gray-100 text-base leading-6">
                            {/* 直接显示完整的建议内容 */}
                            {suggestion}
                          </h3>
                        </div>
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg
                            className="w-4 h-4 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {messages.map((message, index) => (
        <div
          key={message.id}
          className="w-full mx-auto max-w-3xl px-4 group/message"
          data-role={message.role}
        >
          {/* 完全按照原版HTML结构 */}
          <div
            className={`flex gap-4 w-full ${
              message.role === 'user'
                ? 'group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:w-fit'
                : ''
            }`}
          >
            {/* 头像 - 只有AI显示星星图标，用户不显示头像 */}
            {message.role === 'assistant' && (
              <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
                <div className="translate-y-px">
                  {/* AI头像 - 星星图标 */}
                  <svg
                    height="14"
                    strokeLinejoin="round"
                    viewBox="0 0 16 16"
                    width="14"
                    style={{ color: 'currentcolor' }}
                  >
                    <path
                      d="M2.5 0.5V0H3.5V0.5C3.5 1.60457 4.39543 2.5 5.5 2.5H6V3V3.5H5.5C4.39543 3.5 3.5 4.39543 3.5 5.5V6H3H2.5V5.5C2.5 4.39543 1.60457 3.5 0.5 3.5H0V3V2.5H0.5C1.60457 2.5 2.5 1.60457 2.5 0.5Z"
                      fill="currentColor"
                    ></path>
                    <path
                      d="M14.5 4.5V5H13.5V4.5C13.5 3.94772 13.0523 3.5 12.5 3.5H12V3V2.5H12.5C13.0523 2.5 13.5 2.05228 13.5 1.5V1H14H14.5V1.5C14.5 2.05228 14.9477 2.5 15.5 2.5H16V3V3.5H15.5C14.9477 3.5 14.5 3.94772 14.5 4.5Z"
                      fill="currentColor"
                    ></path>
                    <path
                      d="M8.40706 4.92939L8.5 4H9.5L9.59294 4.92939C9.82973 7.29734 11.7027 9.17027 14.0706 9.40706L15 9.5V10.5L14.0706 10.5929C11.7027 10.8297 9.82973 12.7027 9.59294 15.0706L9.5 16H8.5L8.40706 15.0706C8.17027 12.7027 6.29734 10.8297 3.92939 10.5929L3 10.5V9.5L3.92939 9.40706C6.29734 9.17027 8.17027 7.29734 8.40706 4.92939Z"
                      fill="currentColor"
                    ></path>
                  </svg>
                </div>
              </div>
            )}

            {/* 消息内容 */}
            <div className="flex flex-col gap-4 w-full">
              <div
                data-testid="message-attachments"
                className="flex flex-row justify-end gap-2"
              ></div>
              <div className="flex flex-row gap-2 items-start">
                <div
                  data-testid="message-content"
                  className="flex flex-col gap-4"
                >
                  <div className="markdown-content">
                    <Markdown>{message.content}</Markdown>
                    {isLoading &&
                      index === messages.length - 1 &&
                      message.role === 'assistant' && (
                        <span className="inline-flex items-center ml-2">
                          <LoadingIndicator type="spinner" />
                        </span>
                      )}
                  </div>
                </div>
              </div>

              {/* 消息操作按钮 - 只对AI消息显示 */}
              {message.role === 'assistant' && (
                <div className="flex flex-row gap-2">
                  {/* 复制按钮 */}
                  <button
                    onClick={() => onCopyMessage(message.content)}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground py-1 px-2 h-fit text-muted-foreground"
                  >
                    <svg
                      height="16"
                      strokeLinejoin="round"
                      viewBox="0 0 16 16"
                      width="16"
                      style={{ color: 'currentcolor' }}
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M2.75 0.5C1.7835 0.5 1 1.2835 1 2.25V9.75C1 10.7165 1.7835 11.5 2.75 11.5H3.75H4.5V10H3.75H2.75C2.61193 10 2.5 9.88807 2.5 9.75V2.25C2.5 2.11193 2.61193 2 2.75 2H8.25C8.38807 2 8.5 2.11193 8.5 2.25V3H10V2.25C10 1.2835 9.2165 0.5 8.25 0.5H2.75ZM7.75 4.5C6.7835 4.5 6 5.2835 6 6.25V13.75C6 14.7165 6.7835 15.5 7.75 15.5H13.25C14.2165 15.5 15 14.7165 15 13.75V6.25C15 5.2835 14.2165 4.5 13.25 4.5H7.75ZM7.5 6.25C7.5 6.11193 7.61193 6 7.75 6H13.25C13.3881 6 13.5 6.11193 13.5 6.25V13.75C13.5 13.8881 13.3881 14 13.25 14H7.75C7.61193 14 7.5 13.8881 7.5 13.75V6.25Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>

                  {/* 点赞按钮 */}
                  <button
                    onClick={() => onVoteMessage(message.id, 'up')}
                    className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground py-1 px-2 h-fit ${
                      message.vote_status === 'praise'
                        ? 'text-green-600 border-green-600 bg-green-50'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <svg
                      height="16"
                      strokeLinejoin="round"
                      viewBox="0 0 16 16"
                      width="16"
                      style={{ color: 'currentcolor' }}
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M6.89531 2.23972C6.72984 2.12153 6.5 2.23981 6.5 2.44315V5.25001C6.5 6.21651 5.7165 7.00001 4.75 7.00001H2.5V13.5H12.1884C12.762 13.5 13.262 13.1096 13.4011 12.5532L14.4011 8.55318C14.5984 7.76425 14.0017 7.00001 13.1884 7.00001H9.25H8.5V6.25001V3.51458C8.5 3.43384 8.46101 3.35807 8.39531 3.31114L6.89531 2.23972ZM5 2.44315C5 1.01975 6.6089 0.191779 7.76717 1.01912L9.26717 2.09054C9.72706 2.41904 10 2.94941 10 3.51458V5.50001H13.1884C14.9775 5.50001 16.2903 7.18133 15.8563 8.91698L14.8563 12.917C14.5503 14.1412 13.4503 15 12.1884 15H1.75H1V14.25V6.25001V5.50001H1.75H4.75C4.88807 5.50001 5 5.38808 5 5.25001V2.44315Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>

                  {/* 点踩按钮 */}
                  <button
                    onClick={() => onVoteMessage(message.id, 'down')}
                    className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground py-1 px-2 h-fit ${
                      message.vote_status === 'criticism'
                        ? 'text-red-600 border-red-600 bg-red-50'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <svg
                      height="16"
                      strokeLinejoin="round"
                      viewBox="0 0 16 16"
                      width="16"
                      style={{ color: 'currentcolor' }}
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M6.89531 13.7603C6.72984 13.8785 6.5 13.7602 6.5 13.5569V10.75C6.5 9.7835 5.7165 9 4.75 9H2.5V2.5H12.1884C12.762 2.5 13.262 2.89037 13.4011 3.44683L14.4011 7.44683C14.5984 8.23576 14.0017 9 13.1884 9H9.25H8.5V9.75V12.4854C8.5 12.5662 8.46101 12.6419 8.39531 12.6889L6.89531 13.7603ZM5 13.5569C5 14.9803 6.6089 15.8082 7.76717 14.9809L9.26717 13.9095C9.72706 13.581 10 13.0506 10 12.4854V10.5H13.1884C14.9775 10.5 16.2903 8.81868 15.8563 7.08303L14.8563 3.08303C14.5503 1.85882 13.4503 1 12.1884 1H1.75H1V1.75V9.75V10.5H1.75H4.75C4.88807 10.5 5 10.6119 5 10.75V13.5569Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {isLoading &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && (
          <div
            className="w-full mx-auto max-w-3xl px-4 group/message"
            data-role="assistant"
          >
            <div className="flex gap-4 w-full">
              <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
                <div className="translate-y-px">
                  <svg
                    height="14"
                    strokeLinejoin="round"
                    viewBox="0 0 16 16"
                    width="14"
                    style={{ color: 'currentcolor' }}
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <circle cx="6" cy="6" r="1" fill="currentColor" />
                    <circle cx="10" cy="6" r="1" fill="currentColor" />
                    <path
                      d="M5.5 10.5c1 1 3 1 5 0"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
              <div className="flex flex-col gap-4 w-full">
                <div className="flex flex-row gap-2 items-start">
                  <div
                    data-testid="message-content"
                    className="flex flex-col gap-4"
                  >
                    <div className="flex items-center gap-3 py-2">
                      <LoadingIndicator type="dots" />
                    </div>
                  </div>
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

  // 复制消息到剪贴板
  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('已复制到剪贴板');
    } catch (error) {
      toast.error('复制失败');
    }
  };

  // 处理建议点击 - 直接发送消息
  const handleSuggestionClick = async (suggestion: string) => {
    // 简单检查：如果没有 session 就打开登录对话框
    if (!session?.user) {
      openLoginDialog();
      return;
    }

    if (isLoading) {
      // 触发停止按钮的提示显示
      const tooltip = document.querySelector(
        '[data-testid="stop-tooltip"]',
      ) as HTMLElement;
      if (tooltip) {
        tooltip.setAttribute('data-show-tooltip', 'true');
        setTimeout(() => {
          tooltip.removeAttribute('data-show-tooltip');
        }, 2000);
      }
      return;
    }

    const userMessage: SimpleUIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: suggestion.trim(),
      createdAt: new Date(),
    };

    const assistantMessage: SimpleUIMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
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
      let accumulatedContent = '';
      let lastUpdateTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // 最后一次更新，确保所有内容都显示
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === 'assistant') {
              lastMessage.content = accumulatedContent;
            }
            return newMessages;
          });
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        accumulatedContent += chunk;

        // 限制更新频率：每50ms或每10个字符更新一次
        const now = Date.now();
        if (now - lastUpdateTime > 50 || chunk.length >= 10) {
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === 'assistant') {
              lastMessage.content = accumulatedContent;
            }
            return newMessages;
          });
          lastUpdateTime = now;

          // 添加小延迟以产生打字效果
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
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

  // 处理点赞/踩
  const handleVote = async (messageId: string, voteType: 'up' | 'down') => {
    // 简单检查：如果没有 session 就打开登录对话框
    if (!session?.user) {
      openLoginDialog();
      return;
    }

    try {
      // 获取消息元数据
      const metadataResponse = await fetch(
        `/api/chat/message-metadata?chatId=${id}&messageId=${messageId}`,
      );

      if (!metadataResponse.ok) {
        throw new Error('Failed to get message metadata');
      }

      const metadata = await metadataResponse.json();

      // 获取当前消息的投票状态
      const currentMessage = messages.find((msg) => msg.id === messageId);
      const currentVoteStatus = currentMessage?.vote_status;

      // 确定交互类型
      let interactionType: string;
      if (voteType === 'up') {
        // 如果当前已经点赞，则取消点赞；否则点赞
        interactionType =
          currentVoteStatus === 'praise' ? 'cancel_praise' : 'add_praise';
      } else {
        // 如果当前已经点踩，则取消点踩；否则点踩
        interactionType =
          currentVoteStatus === 'criticism'
            ? 'cancel_criticism'
            : 'add_criticism';
      }

      // 调用交互API
      const response = await fetch('/api/chat/interaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: metadata.conversation_id,
          msg_id: metadata.msg_id,
          interaction_type: interactionType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to interact with message');
      }

      const result = await response.json();

      // 更新本地消息状态
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, vote_status: result.vote_status }
            : msg,
        ),
      );

      // 显示成功消息
      if (result.vote_status === 'praise') {
        toast.success('点赞成功');
      } else if (result.vote_status === 'criticism') {
        toast.success('点踩成功');
      } else {
        toast.success('已取消');
      }
    } catch (error) {
      console.error('Vote failed:', error);
      toast.error('操作失败，请重试');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 简单检查：如果没有 session 就打开登录对话框
    if (!session?.user) {
      openLoginDialog();
      return;
    }

    if (!input.trim()) {
      return;
    }

    if (isLoading) {
      // 触发停止按钮的提示显示
      const tooltip = document.querySelector(
        '[data-testid="stop-tooltip"]',
      ) as HTMLElement;
      if (tooltip) {
        tooltip.setAttribute('data-show-tooltip', 'true');
        setTimeout(() => {
          tooltip.removeAttribute('data-show-tooltip');
        }, 2000);
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
      let accumulatedContent = '';
      let lastUpdateTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // 最后一次更新，确保所有内容都显示
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === 'assistant') {
              lastMessage.content = accumulatedContent;
            }
            return newMessages;
          });
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        accumulatedContent += chunk;

        // 限制更新频率：每50ms或每10个字符更新一次
        const now = Date.now();
        if (now - lastUpdateTime > 50 || chunk.length >= 10) {
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === 'assistant') {
              lastMessage.content = accumulatedContent;
            }
            return newMessages;
          });
          lastUpdateTime = now;

          // 添加小延迟以产生打字效果
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
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
        <BeautifulMessages
          messages={messages}
          isLoading={isLoading}
          onCopyMessage={copyToClipboard}
          onVoteMessage={handleVote}
          onSuggestionClick={handleSuggestionClick}
          session={session}
        />
        <div className="mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          <form onSubmit={handleSubmit}>
            <div className="relative flex items-end gap-2 p-3 border border-input rounded-xl bg-background focus-within:border-ring">
              <div className="flex-1 min-h-[60px] flex items-center">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder="你想了解什么"
                  rows={2}
                  className="w-full resize-none border-0 bg-transparent px-4 py-3 text-base placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    minHeight: '60px',
                    maxHeight: '240px',
                    height: 'auto',
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${Math.min(target.scrollHeight, 240)}px`;
                  }}
                />
              </div>

              <div className="flex gap-1">
                {isLoading ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={stop}
                      data-testid="stop-button"
                      className="inline-flex items-center justify-center rounded-full w-8 h-8 bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                      title="停止生成"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                      </svg>
                    </button>
                    {/* Tooltip */}
                    <div
                      data-testid="stop-tooltip"
                      className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap opacity-0 pointer-events-none transition-opacity duration-200 data-[show-tooltip]:opacity-100"
                    >
                      停止生成
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="inline-flex items-center justify-center rounded-lg w-8 h-8 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="发送消息"
                  >
                    <div
                      className="ds-icon"
                      style={{
                        fontSize: '16px',
                        width: '16px',
                        height: '16px',
                      }}
                    >
                      <svg
                        width="14"
                        height="16"
                        viewBox="0 0 14 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M7 16c-.595 0-1.077-.462-1.077-1.032V1.032C5.923.462 6.405 0 7 0s1.077.462 1.077 1.032v13.936C8.077 15.538 7.595 16 7 16z"
                          fill="currentColor"
                        ></path>
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M.315 7.44a1.002 1.002 0 0 1 0-1.46L6.238.302a1.11 1.11 0 0 1 1.523 0c.421.403.421 1.057 0 1.46L1.838 7.44a1.11 1.11 0 0 1-1.523 0z"
                          fill="currentColor"
                        ></path>
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M13.685 7.44a1.11 1.11 0 0 1-1.523 0L6.238 1.762a1.002 1.002 0 0 1 0-1.46 1.11 1.11 0 0 1 1.523 0l5.924 5.678c.42.403.42 1.056 0 1.46z"
                          fill="currentColor"
                        ></path>
                      </svg>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
