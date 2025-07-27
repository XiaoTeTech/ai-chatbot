'use server';

import { generateText, Message } from 'ai';
import { cookies } from 'next/headers';

// 注意：这些函数现在使用外部API，不再需要数据库查询
// import {
//   deleteMessagesByChatIdAfterTimestamp,
//   getMessageById,
//   updateChatVisiblityById,
// } from '@/lib/db/queries';
// import { VisibilityType } from '@/components/visibility-selector';
import { myProvider } from '@/lib/ai/providers';

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: Message;
}) {
  const { text: title } = await generateText({
    model: (await myProvider()).languageModel('title-model'),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}

// 这些函数现在需要通过外部API实现，暂时注释掉
// export async function deleteTrailingMessages({ id }: { id: string }) {
//   // 需要调用外部API删除消息
//   console.warn('deleteTrailingMessages not implemented with external API');
// }

// export async function updateChatVisibility({
//   chatId,
//   visibility,
// }: {
//   chatId: string;
//   visibility: VisibilityType;
// }) {
//   // 需要调用外部API更新对话可见性
//   console.warn('updateChatVisibility not implemented with external API');
// }
