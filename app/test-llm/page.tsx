import { auth } from '@/app/(auth)/auth';
import { externalChatService } from '@/lib/api/external-chat-service';

export default async function TestLLMPage() {
  const session = await auth();

  if (!session || !session.user) {
    return <div>请先登录</div>;
  }

  if (!session.user.lcSessionToken) {
    return <div>缺少LC Session Token</div>;
  }

  let testResult = '';
  let error = '';

  try {
    // 测试非流式LLM API
    const result = await externalChatService.chatCompletion(
      session.user.lcSessionToken,
      {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: '你好，请简单回复一下' }
        ],
        stream: false,
        temperature: 0.5,
        presence_penalty: 0,
        frequency_penalty: 0,
        top_p: 1,
      }
    );
    testResult = JSON.stringify(result, null, 2);
  } catch (err: any) {
    error = err.message || '未知错误';
    console.error('LLM API测试失败:', err);
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">LLM API 测试</h1>
      
      <div className="mb-4">
        <h2 className="text-lg font-semibold">用户信息:</h2>
        <p>用户ID: {session.user.id}</p>
        <p>LC Session Token: {session.user.lcSessionToken?.substring(0, 10)}...</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <h2 className="text-lg font-semibold">错误:</h2>
          <pre className="whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {testResult && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          <h2 className="text-lg font-semibold">成功响应:</h2>
          <pre className="whitespace-pre-wrap text-sm">{testResult}</pre>
        </div>
      )}

      <div className="mt-4">
        <a href="/" className="text-blue-500 hover:underline">返回首页</a>
      </div>
    </div>
  );
}
