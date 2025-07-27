'use client';

import type { Attachment, UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { useLoginDialog } from '@/lib/context';
import { useRouter } from 'next/navigation';

export function Chat({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig();
  const { data: session } = useSession();
  const { open } = useLoginDialog();
  const router = useRouter();

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    status,
    stop,
    reload,
  } = useChat({
    id,
    body: { id, selectedChatModel: selectedChatModel },
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    onFinish: (message) => {
      console.log('🎉 Chat finished, mutating history');
      console.log('🔍 onFinish message:', {
        id: message.id,
        role: message.role,
        hasEncoding: message.id.includes(':-'),
      });
      mutate('/api/history');

      // 如果当前是新对话（id === 'new'），尝试从消息ID中获取真实的conversation_id
      if (id === 'new' && message.id.includes(':-')) {
        const parts = message.id.split(':-');
        if (parts.length === 2) {
          const idParts = parts[1].split('-');
          if (idParts.length === 2) {
            const conversationId = idParts[0];
            console.log(
              '🔄 Redirecting from new chat to conversation:',
              conversationId,
            );
            router.push(`/chat/${conversationId}`);
          }
        }
      }
    },
    onError: (error) => {
      console.error('🚨 Chat error:', error);
      toast.error('出问题啦，请再试一次！');
    },
    onResponse: (response) => {
      console.log(
        '📥 Received chat response:',
        response.status,
        response.statusText,
      );

      // 读取消息元数据
      const conversationId = response.headers.get('X-Conversation-Id');
      const msgId = response.headers.get('X-Message-Id');

      if (conversationId && msgId) {
        const metadata = {
          conversationId: Number.parseInt(conversationId),
          msgId: Number.parseInt(msgId),
        };
        setLastMessageMetadata(metadata);
        console.log('📋 收到消息元数据:', metadata);
      }
    },
  });

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 && id !== 'new' ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const [lastMessageMetadata, setLastMessageMetadata] = useState<{
    conversationId?: number;
    msgId?: number;
  }>({});
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  const handleMessageSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!session?.user) {
      open();
      return;
    }
    handleSubmit(e);
  };

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedVisibilityType={selectedVisibilityType}
          isReadonly={isReadonly}
        />

        <Messages
          chatId={id}
          status={status}
          votes={votes}
          messages={messages as any}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
          lastMessageMetadata={lastMessageMetadata}
        />

        <form
          className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl"
          onSubmit={handleMessageSubmit}
        >
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages as any}
              setMessages={setMessages}
              append={append}
            />
          )}
        </form>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages as any}
        setMessages={setMessages}
        reload={reload}
        votes={votes}
        isReadonly={isReadonly}
      />
    </>
  );
}
