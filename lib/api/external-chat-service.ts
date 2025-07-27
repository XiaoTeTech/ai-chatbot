import 'server-only';

// 外部聊天服务的API客户端
// 基于 https://uther.xiaote.net/openapi.json 的接口规范

const EXTERNAL_API_BASE_URL = process.env.EXTERNAL_CHAT_API_URL || 'https://uther.xiaote.net';

// 基础API响应类型
interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

// 分页信息
interface PaginationInfo {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// 对话响应模型
interface ConversationResponse {
  id: number;
  title?: string | null;
  start_time: number;
  last_interaction_time: number;
}

// 对话列表响应
interface ConversationsPaginatedResponse {
  items: ConversationResponse[];
  pagination: PaginationInfo;
}

// 聊天历史记录响应模型
interface ChatHistoryResponse {
  msg_id: number;
  conversation_id: number;
  message: string;
  msg_type: string; // 'user' | 'assistant'
  timestamp: number;
  vote_status?: string | null; // 'praise' | 'criticism' | null
}

// 聊天历史分页响应
interface ChatHistoryPaginatedResponse {
  items: ChatHistoryResponse[];
  pagination: PaginationInfo;
}

// 消息交互请求
interface InteractionRequest {
  conversation_id: number;
  msg_id: number;
  interaction_type: 'add_praise' | 'cancel_praise' | 'add_criticism' | 'cancel_criticism';
}

// 消息交互响应
interface InteractionResponse {
  vote_status?: string | null;
}

// LLM聊天完成请求
interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  stream?: boolean;
  conversation_id?: string | null;
}

// API错误类
class ExternalApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ExternalApiError';
  }
}

// API客户端类
export class ExternalChatService {
  private baseUrl: string;

  constructor(baseUrl: string = EXTERNAL_API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // 创建带认证的请求头
  private createHeaders(lcSessionToken?: string): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (lcSessionToken) {
      headers['X-LC-Session'] = lcSessionToken;
    }

    return headers;
  }

  // 通用API请求方法
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    lcSessionToken?: string
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.createHeaders(lcSessionToken);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ExternalApiError(
          `API request failed: ${response.status} ${response.statusText}`,
          response.status,
          errorText
        );
      }

      // 处理空响应
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ExternalApiError) {
        throw error;
      }
      throw new ExternalApiError(`Network error: ${error.message}`);
    }
  }

  // 获取对话列表
  async getConversations(
    lcSessionToken: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<ConversationsPaginatedResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });

    return this.request<ConversationsPaginatedResponse>(
      `/api/chat/conversations?${params}`,
      { method: 'GET' },
      lcSessionToken
    );
  }

  // 获取对话详情
  async getConversationDetail(
    lcSessionToken: string,
    conversationId: number
  ): Promise<ConversationResponse> {
    const params = new URLSearchParams({
      conversation_id: conversationId.toString(),
    });

    return this.request<ConversationResponse>(
      `/api/chat/conversations/detail?${params}`,
      { method: 'GET' },
      lcSessionToken
    );
  }

  // 获取聊天历史
  async getChatHistory(
    lcSessionToken: string,
    conversationId?: number,
    keyword?: string,
    page: number = 1,
    pageSize: number = 10,
    voteStatus?: string
  ): Promise<ChatHistoryPaginatedResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });

    if (conversationId) {
      params.append('conversation_id', conversationId.toString());
    }
    if (keyword) {
      params.append('keyword', keyword);
    }
    if (voteStatus) {
      params.append('vote_status', voteStatus);
    }

    return this.request<ChatHistoryPaginatedResponse>(
      `/api/chat/history?${params}`,
      { method: 'GET' },
      lcSessionToken
    );
  }

  // 删除对话
  async deleteConversation(
    lcSessionToken: string,
    conversationId: number
  ): Promise<void> {
    const params = new URLSearchParams({
      conversation_id: conversationId.toString(),
    });

    await this.request(
      `/api/chat/conversation?${params}`,
      { method: 'DELETE' },
      lcSessionToken
    );
  }

  // 删除聊天记录
  async deleteChatRecord(
    lcSessionToken: string,
    conversationId: number,
    msgId: number
  ): Promise<void> {
    const params = new URLSearchParams({
      conversation_id: conversationId.toString(),
      msg_id: msgId.toString(),
    });

    await this.request(
      `/api/chat/history?${params}`,
      { method: 'DELETE' },
      lcSessionToken
    );
  }

  // 消息交互（点赞/踩）
  async interactWithMessage(
    lcSessionToken: string,
    request: InteractionRequest
  ): Promise<InteractionResponse> {
    return this.request<InteractionResponse>(
      '/api/chat/interaction',
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
      lcSessionToken
    );
  }

  // LLM聊天完成（非流式）
  async chatCompletion(
    lcSessionToken: string,
    request: ChatCompletionRequest
  ): Promise<any> {
    return this.request(
      '/v1/chat/completions',
      {
        method: 'POST',
        body: JSON.stringify({ ...request, stream: false }),
      },
      lcSessionToken
    );
  }

  // LLM聊天完成（流式）
  async chatCompletionStream(
    lcSessionToken: string,
    request: ChatCompletionRequest
  ): Promise<ReadableStream> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const headers = this.createHeaders(lcSessionToken);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...request, stream: true }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ExternalApiError(
        `Stream API request failed: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    if (!response.body) {
      throw new ExternalApiError('No response body for stream');
    }

    return response.body;
  }
}

// 导出单例实例
export const externalChatService = new ExternalChatService();

// 导出类型
export type {
  ConversationResponse,
  ConversationsPaginatedResponse,
  ChatHistoryResponse,
  ChatHistoryPaginatedResponse,
  InteractionRequest,
  InteractionResponse,
  ChatCompletionRequest,
  ExternalApiError,
};
