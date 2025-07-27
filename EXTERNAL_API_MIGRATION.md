# 外部聊天服务API迁移文档

## 概述

本项目已成功从本地数据库存储的聊天系统迁移到使用外部聊天服务API。这次迁移将聊天数据的存储和处理完全委托给外部服务，同时保留了用户认证相关的本地数据库操作。

## 迁移内容

### 🔄 已迁移的功能

1. **聊天历史获取** - 从 `getChatsByUserId` 迁移到 `/api/chat/conversations`
2. **聊天消息获取** - 从 `getMessagesByChatId` 迁移到 `/api/chat/history`
3. **聊天删除** - 从 `deleteChatById` 迁移到 `/api/chat/conversation`
4. **消息投票** - 从 `voteMessage/getVotesByChatId` 迁移到 `/api/chat/interaction`
5. **LLM聊天** - 从本地AI提供商迁移到 `/v1/chat/completions`

### 🏗️ 新增的组件

#### 1. API服务适配层 (`lib/api/external-chat-service.ts`)
- 封装所有外部API调用
- 统一错误处理和重试机制
- 支持流式和非流式响应

#### 2. 数据转换层 (`lib/api/data-transformers.ts`)
- 将外部API数据格式转换为前端期望的格式
- 处理时间戳、分页信息等数据转换
- 提供数据验证和清理功能

#### 3. 简化的用户数据库 (`lib/db/user-queries.ts`, `lib/db/user-schema.ts`)
- 只保留用户认证相关的数据库操作
- 移除了聊天、消息、投票相关的数据库表和查询

### 🔐 认证机制

- 使用 `X-LC-Session` header 进行API认证
- 从NextAuth session中获取 `lcSessionToken`
- 保持与现有登录流程的兼容性

## API接口映射

| 原本地功能 | 外部API端点 | 说明 |
|-----------|------------|------|
| 获取对话列表 | `GET /api/chat/conversations` | 支持分页 |
| 获取对话详情 | `GET /api/chat/conversations/detail` | 获取单个对话信息 |
| 获取聊天历史 | `GET /api/chat/history` | 支持搜索和分页 |
| 删除对话 | `DELETE /api/chat/conversation` | 删除整个对话 |
| 删除消息 | `DELETE /api/chat/history` | 删除特定消息 |
| 消息交互 | `POST /api/chat/interaction` | 点赞/踩消息 |
| LLM聊天 | `POST /v1/chat/completions` | OpenAI兼容格式 |

## 环境配置

### 必需的环境变量

```bash
# 外部聊天服务API地址
EXTERNAL_CHAT_API_URL=https://uther.xiaote.net

# 测试用的LC Session Token（仅用于测试脚本）
TEST_LC_SESSION_TOKEN=your_test_token_here
```

## 测试

### 运行API测试脚本

```bash
# 设置测试token
export TEST_LC_SESSION_TOKEN="your_test_token"

# 运行测试
npx tsx scripts/test-external-api.ts
```

### 测试覆盖范围

- ✅ 获取对话列表
- ✅ 获取聊天历史
- ✅ LLM聊天完成
- ✅ 消息交互（点赞/踩）
- ✅ 对话删除
- ✅ 数据格式转换

## 已知限制

1. **流式响应处理** - 目前直接转发外部API的流式响应，可能需要进一步优化
2. **错误处理** - 外部API的错误信息可能需要更好的本地化处理
3. **缓存机制** - 暂未实现本地缓存，所有数据都实时从外部API获取
4. **离线支持** - 完全依赖外部服务，无离线功能

## 迁移后的文件结构

```
lib/
├── api/
│   ├── external-chat-service.ts    # 外部API客户端
│   └── data-transformers.ts        # 数据转换函数
├── db/
│   ├── user-queries.ts             # 用户相关查询（保留）
│   ├── user-schema.ts              # 用户数据库模式（简化）
│   ├── queries.ts                  # 原查询文件（已弃用）
│   └── schema.ts                   # 原数据库模式（已弃用）
└── ...

app/(chat)/
├── api/
│   ├── chat/route.ts               # 已更新使用外部API
│   ├── vote/route.ts               # 已更新使用外部API
│   └── history/route.ts            # 已更新使用外部API
├── chat/[id]/page.tsx              # 已更新使用外部API
└── actions.ts                      # 部分功能已注释

scripts/
└── test-external-api.ts            # API测试脚本
```

## 回滚计划

如需回滚到原本地数据库方案：

1. 恢复 `lib/db/queries.ts` 和 `lib/db/schema.ts`
2. 更新API路由文件移除外部API调用
3. 恢复 `app/(chat)/actions.ts` 中被注释的函数
4. 移除 `lib/api/` 目录下的新文件

## 性能考虑

- **网络延迟** - 所有聊天操作现在都需要网络请求
- **API限制** - 需要注意外部服务的速率限制
- **数据传输** - 大量聊天历史可能影响加载速度

## 安全考虑

- **Token安全** - lcSessionToken的安全存储和传输
- **API访问控制** - 确保只有授权用户能访问外部API
- **数据隐私** - 聊天数据现在存储在外部服务中

## 后续优化建议

1. 实现本地缓存机制减少API调用
2. 添加更详细的错误处理和用户反馈
3. 实现批量操作以提高效率
4. 添加API调用监控和日志
5. 考虑实现部分离线功能
