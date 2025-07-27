import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { auth } from '@/app/(auth)/auth';
import type { ExtendedUser } from '@/app/(auth)/auth';
import { cache } from 'react';
import { headers } from 'next/headers';

const getAuthSession = cache(async () => {
  const session = await auth();
  return session;
});

const createMyProvider = async (token: string) => {
  const headersList = await headers();
  const clientIp =
    headersList.get('x-forwarded-for') ||
    headersList.get('x-real-ip') ||
    headersList.get('remote-addr') ||
    '';
  console.log('clientIp', clientIp);

  return createOpenAICompatible({
    baseURL: 'https://uther.xiaote.net/v1',
    name: 'tesla',
    apiKey: token,
    headers: {
      is_from_web: 'true',
      'X-Forwarded-For': clientIp || '',
      'X-Real-IP': clientIp || '',
    },
  });
};

const defaultQwenProvider = createOpenAICompatible({
  baseURL:
    process.env.DASHSCOPE_API_KEY_BASE ||
    'https://dashscope.aliyuncs.com/api/v1',
  name: 'qwen',
  apiKey: process.env.DASHSCOPE_API_KEY,
});

export async function myProvider() {
  const session = await getAuthSession();
  const token = (session?.user as ExtendedUser)?.lcSessionToken || '';
  const provider = await createMyProvider(token);
  return customProvider({
    languageModels: {
      'chat-model': provider('qwen-plus'),
      'chat-model-reasoning': wrapLanguageModel({
        model: provider('qwen-max'),
        middleware: extractReasoningMiddleware({ tagName: 'think' }),
      }),
      'title-model': defaultQwenProvider('qwen-turbo'),
      'artifact-model': defaultQwenProvider('qwen-turbo'),
      'suggested-model': defaultQwenProvider('qwen-plus'),
    },
  });
}
