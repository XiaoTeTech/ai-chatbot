// 简单测试应用配置API
const testConfig = {
  store_url: "https://item.taobao.com/item.htm?id=904474346680",
  store_app_scheme: "taobao://item.taobao.com/item.htm?id=904474346680",
  vehicle_data_polling_interval: 8,
  sentence_stop_delay: 1.5,
  support_email: "support@tesla.com",
  chat_introduction: "嘿，我是小特AI！随时为你解惑，点燃生活✨与工作💼的灵感火花💡。有什么想聊的？",
  chat_suggestions: [
    "我们来玩一把「成语接龙」吧？",
    "特斯拉股价今天表现如何？",
    "最近有哪些AI技术突破？",
    "今天的电动车新闻有哪些？"
  ]
};

console.log('测试配置:', JSON.stringify(testConfig, null, 2));
