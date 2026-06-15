const API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const API_MODEL = "glm-5.1";
const API_MAX_TOKENS = 65536;
const API_TEMPERATURE = 1.0;

const SYSTEM_PROMPT = `你是刘宇个人网站上的 AI 助手，以第一人称「我」代表刘宇与访客对话。

关于刘宇：
- 产品经理，专注把复杂问题转化成清晰可落地的产品体验
- 工作涵盖需求分析、功能规划、跨团队协作推进
- 爱好旅行、摄影，喜欢观察真实用户场景
- 标签：产品经理、用户体验、旅行、摄影
- 邮箱：icey66@sina.com
- 电话：17301302676

回答要求：
- 使用简洁、友好的中文
- 只基于以上公开信息回答，不编造经历或数据
- 无关问题可简短回应，并自然引导回刘宇相关话题
- 回复长度适中，适合聊天界面阅读`;

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, payload) {
  setCors(res);
  res.status(status).json(payload);
}

function getApiKey() {
  const key = process.env.ZHIPU_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "未配置 ZHIPU_API_KEY：请在 Vercel 项目 Settings → Environment Variables 中添加"
    );
  }
  return key;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    setCors(res);
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method Not Allowed" });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages)) {
    return sendJson(res, 400, { error: "messages 必须是数组" });
  }

  const chatMessages = messages.filter(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim()
  );

  if (!chatMessages.length) {
    return sendJson(res, 400, { error: "messages 不能为空" });
  }

  let apiKey;
  try {
    apiKey = getApiKey();
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }

  const payload = {
    model: API_MODEL,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...chatMessages],
    thinking: { type: "enabled" },
    max_tokens: API_MAX_TOKENS,
    temperature: API_TEMPERATURE,
  };

  let upstream;
  try {
    upstream = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return sendJson(res, 502, {
      error: `无法连接智谱 API：${err.message || "请检查网络后重试"}`,
    });
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    return sendJson(res, 502, { error: "智谱 API 返回了无法解析的响应" });
  }

  if (!upstream.ok) {
    const message =
      data?.error?.message || data?.message || data?.msg || `模型请求失败（${upstream.status}）`;
    const status = upstream.status === 401 ? 401 : upstream.status >= 500 ? 502 : upstream.status;
    return sendJson(res, status, { error: message });
  }

  const message = data?.choices?.[0]?.message;
  const content = (message?.content || message?.reasoning_content || "").trim();
  if (!content) {
    return sendJson(res, 502, { error: "模型未返回有效内容" });
  }

  return sendJson(res, 200, { content });
}
