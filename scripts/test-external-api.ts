#!/usr/bin/env tsx

/**
 * 测试外部聊天服务API的脚本
 * 使用方法: npx tsx scripts/test-external-api.ts
 */

import { externalChatService } from '../lib/api/external-chat-service';

// 测试用的LC Session Token（需要替换为真实的token）
const TEST_LC_SESSION_TOKEN = process.env.TEST_LC_SESSION_TOKEN || '';

if (!TEST_LC_SESSION_TOKEN) {
  console.error('请设置 TEST_LC_SESSION_TOKEN 环境变量');
  process.exit(1);
}

async function testGetConversations() {
  console.log('🧪 测试获取对话列表...');
  try {
    const result = await externalChatService.getConversations(
      TEST_LC_SESSION_TOKEN,
      1,
      10
    );
    console.log('✅ 获取对话列表成功:', {
      total: result.pagination.total,
      items: result.items.length,
      firstItem: result.items[0] || null,
    });
    return result.items[0]?.id; // 返回第一个对话ID用于后续测试
  } catch (error) {
    console.error('❌ 获取对话列表失败:', error);
    return null;
  }
}

async function testGetChatHistory(conversationId?: number) {
  if (!conversationId) {
    console.log('⏭️  跳过聊天历史测试（没有可用的对话ID）');
    return null;
  }

  console.log('🧪 测试获取聊天历史...');
  try {
    const result = await externalChatService.getChatHistory(
      TEST_LC_SESSION_TOKEN,
      conversationId,
      undefined,
      1,
      10
    );
    console.log('✅ 获取聊天历史成功:', {
      total: result.pagination.total,
      items: result.items.length,
      firstMessage: result.items[0] || null,
    });
    return result.items[0]?.msg_id; // 返回第一个消息ID用于后续测试
  } catch (error) {
    console.error('❌ 获取聊天历史失败:', error);
    return null;
  }
}

async function testChatCompletion() {
  console.log('🧪 测试LLM聊天完成...');
  try {
    const result = await externalChatService.chatCompletion(
      TEST_LC_SESSION_TOKEN,
      {
        model: 'chat-model',
        messages: [
          { role: 'user', content: '你好，请简单介绍一下自己' }
        ],
        stream: false,
      }
    );
    console.log('✅ LLM聊天完成成功:', {
      hasResponse: !!result,
      responseType: typeof result,
    });
    return result;
  } catch (error) {
    console.error('❌ LLM聊天完成失败:', error);
    return null;
  }
}

async function testInteraction(conversationId?: number, msgId?: number) {
  if (!conversationId || !msgId) {
    console.log('⏭️  跳过消息交互测试（没有可用的对话ID或消息ID）');
    return;
  }

  console.log('🧪 测试消息交互（点赞）...');
  try {
    const result = await externalChatService.interactWithMessage(
      TEST_LC_SESSION_TOKEN,
      {
        conversation_id: conversationId,
        msg_id: msgId,
        interaction_type: 'add_praise',
      }
    );
    console.log('✅ 消息交互成功:', result);
  } catch (error) {
    console.error('❌ 消息交互失败:', error);
  }
}

async function runTests() {
  console.log('🚀 开始测试外部聊天服务API...\n');

  // 测试获取对话列表
  const firstConversationId = await testGetConversations();
  console.log('');

  // 测试获取聊天历史
  const firstMessageId = await testGetChatHistory(firstConversationId);
  console.log('');

  // 测试LLM聊天完成
  await testChatCompletion();
  console.log('');

  // 测试消息交互
  await testInteraction(firstConversationId, firstMessageId);
  console.log('');

  console.log('🏁 测试完成！');
}

// 运行测试
runTests().catch(console.error);
