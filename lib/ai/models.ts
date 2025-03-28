export const DEFAULT_CHAT_MODEL: string = 'chat-model';

interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model',
    name: '通用聊天',
    description: '适用于各种场景的主要聊天模型',
  },
  {
    id: 'chat-model-reasoning',
    name: '深度思考',
    description: '采用高级推理能力',
  },
];