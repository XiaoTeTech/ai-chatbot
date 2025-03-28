import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
// eslint-disable-line
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { isTestEnvironment } from '../constants';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';

// Create an OpenAI-compatible provider for Qwen models
const qwenProvider = createOpenAICompatible({
  baseURL:
    process.env.DASHSCOPE_API_KEY_BASE ||
    'https://dashscope.aliyuncs.com/api/v1', // 从环境变量获取，默认使用阿里云Dashscope API
  name: 'qwen',
  apiKey: process.env.DASHSCOPE_API_KEY, // 从环境变量获取API Key
});

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': qwenProvider('qwen-plus'), // 通义千问Plus模型
        'chat-model-reasoning': wrapLanguageModel({
          model: qwenProvider('qwen-max'), // 使用更强大的Qwen Max模型用于推理
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': qwenProvider('qwen-turbo'),
        'artifact-model': qwenProvider('qwen-turbo'),
      },
    });
