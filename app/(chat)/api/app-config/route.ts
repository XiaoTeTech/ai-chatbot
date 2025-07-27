import { auth, type ExtendedUser } from '@/app/(auth)/auth';
import { externalChatService } from '@/lib/api/external-chat-service';

export async function GET() {
  const session = await auth();

  if (!session || !session.user) {
    return Response.json('Unauthorized!', { status: 401 });
  }

  // 检查是否有lcSessionToken
  if (!(session.user as ExtendedUser).lcSessionToken) {
    return Response.json('Missing LC Session Token', { status: 401 });
  }

  // 默认配置
  const defaultConfig = {
    store_url: 'https://item.taobao.com/item.htm?id=904474346680',
    store_app_scheme: 'taobao://item.taobao.com/item.htm?id=904474346680',
    vehicle_data_polling_interval: 8,
    sentence_stop_delay: 1.5,
    support_email: 'support@tesla.com',
    chat_introduction:
      '嘿，我是小特AI！随时为你解惑，点燃生活✨与工作💼的灵感火花💡。有什么想聊的？',
    chat_suggestions: [
      '特斯拉股价今天表现如何？',
      '最近有哪些AI技术突破？',
      '今天的电动车新闻有哪些？',
      '帮我分析一下今天的市场趋势',
    ],
  };

  try {
    // 调用外部API获取应用配置
    const config = await externalChatService.getAppConfig(
      (session.user as any).lcSessionToken,
    );

    // 过滤掉不想显示的聊天建议
    if (config.chat_suggestions && Array.isArray(config.chat_suggestions)) {
      config.chat_suggestions = config.chat_suggestions.filter(
        (suggestion: string) => suggestion !== '我们来玩一把「成语接龙」吧？',
      );
    }

    return Response.json(config);
  } catch (error) {
    console.error('Failed to fetch app config from external API:', error);
    // 返回默认配置
    return Response.json(defaultConfig);
  }
}
