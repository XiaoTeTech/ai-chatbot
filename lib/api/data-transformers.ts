import type { UIMessage, Attachment } from 'ai';
import type { Chat, DBMessage, Vote } from '@/lib/db/schema';
import type {
  ConversationResponse,
  ChatHistoryResponse,
  ConversationsPaginatedResponse,
  ChatHistoryPaginatedResponse,
} from './external-chat-service';

// 将外部API的对话数据转换为本地Chat类型
export function transformConversationToChat(conversation: ConversationResponse): Chat {
  return {
    id: conversation.id.toString(),
    createdAt: new Date(conversation.start_time * 1000),
    title: conversation.title || '新对话',
    userId: '', // 这个字段在外部API中不需要，因为已经通过认证确定了用户
    visibility: 'private' as const, // 默认为私有
  };
}

// 将外部API的对话列表转换为本地Chat数组
export function transformConversationsToChats(
  response: ConversationsPaginatedResponse
): Chat[] {
  return response.items.map(transformConversationToChat);
}

// 将外部API的聊天历史转换为本地DBMessage类型
export function transformChatHistoryToDBMessage(
  history: ChatHistoryResponse
): DBMessage {
  // 将消息内容转换为parts格式
  const parts = [
    {
      type: 'text' as const,
      text: history.message,
    },
  ];

  return {
    id: history.msg_id.toString(),
    chatId: history.conversation_id.toString(),
    role: history.msg_type,
    parts: parts,
    attachments: [], // 外部API暂时不支持附件
    createdAt: new Date(history.timestamp * 1000),
  };
}

// 将外部API的聊天历史列表转换为本地DBMessage数组
export function transformChatHistoryToDBMessages(
  response: ChatHistoryPaginatedResponse
): DBMessage[] {
  return response.items.map(transformChatHistoryToDBMessage);
}

// 将DBMessage转换为UIMessage（用于前端显示）
export function transformDBMessageToUIMessage(dbMessage: DBMessage): UIMessage {
  let content = '';
  if (Array.isArray(dbMessage.parts)) {
    content = dbMessage.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join(' ');
  }

  return {
    id: dbMessage.id,
    parts: dbMessage.parts as UIMessage['parts'],
    role: dbMessage.role as UIMessage['role'],
    content: content,
    createdAt: dbMessage.createdAt,
    experimental_attachments: (dbMessage.attachments as Array<Attachment>) ?? [],
  };
}

// 将DBMessage数组转换为UIMessage数组
export function transformDBMessagesToUIMessages(dbMessages: DBMessage[]): UIMessage[] {
  return dbMessages.map(transformDBMessageToUIMessage);
}

// 将外部API的投票状态转换为本地Vote类型
export function transformVoteStatusToVote(
  chatId: string,
  messageId: string,
  voteStatus?: string | null
): Vote | null {
  if (!voteStatus) {
    return null;
  }

  return {
    chatId,
    messageId,
    isUpvoted: voteStatus === 'praise',
  };
}

// 将UIMessage转换为外部API的消息格式
export function transformUIMessageToExternalFormat(message: UIMessage) {
  return {
    role: message.role,
    content: typeof message.content === 'string' ? message.content : '',
  };
}

// 将UIMessage数组转换为外部API的消息格式数组
export function transformUIMessagesToExternalFormat(messages: UIMessage[]) {
  return messages.map(transformUIMessageToExternalFormat);
}

// 从外部API响应中提取对话ID
export function extractConversationIdFromResponse(response: any): string | null {
  // 这个函数需要根据实际的LLM API响应格式来实现
  // 目前假设响应中包含conversation_id字段
  if (response && response.conversation_id) {
    return response.conversation_id.toString();
  }
  return null;
}

// 生成新的对话ID（如果外部API不自动创建）
export function generateConversationId(): string {
  return Date.now().toString();
}

// 将本地的投票类型转换为外部API的交互类型
export function transformVoteTypeToInteractionType(
  type: 'up' | 'down',
  currentStatus?: string | null
): 'add_praise' | 'cancel_praise' | 'add_criticism' | 'cancel_criticism' {
  if (type === 'up') {
    return currentStatus === 'praise' ? 'cancel_praise' : 'add_praise';
  } else {
    return currentStatus === 'criticism' ? 'cancel_criticism' : 'add_criticism';
  }
}

// 错误消息转换
export function transformApiErrorMessage(error: any): string {
  if (error?.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '发生未知错误';
}

// 分页信息转换
export interface LocalPaginationInfo {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function transformPaginationInfo(
  externalPagination: any
): LocalPaginationInfo {
  return {
    total: externalPagination.total || 0,
    page: externalPagination.page || 1,
    pageSize: externalPagination.page_size || 10,
    totalPages: externalPagination.total_pages || 1,
  };
}

// 时间戳转换工具
export function timestampToDate(timestamp: number): Date {
  // 假设外部API返回的是秒级时间戳
  return new Date(timestamp * 1000);
}

export function dateToTimestamp(date: Date): number {
  // 转换为秒级时间戳
  return Math.floor(date.getTime() / 1000);
}

// 验证数据完整性
export function validateConversationData(conversation: ConversationResponse): boolean {
  return !!(
    conversation.id &&
    conversation.start_time &&
    conversation.last_interaction_time
  );
}

export function validateChatHistoryData(history: ChatHistoryResponse): boolean {
  return !!(
    history.msg_id &&
    history.conversation_id &&
    history.message &&
    history.msg_type &&
    history.timestamp
  );
}

// 数据清理函数
export function sanitizeMessageContent(content: string): string {
  // 清理和验证消息内容
  return content.trim().substring(0, 10000); // 限制长度
}

export function sanitizeConversationTitle(title?: string | null): string {
  if (!title) {
    return '新对话';
  }
  return title.trim().substring(0, 100); // 限制标题长度
}
