/**
 * 本地启动：
 *   npm start       仅启动服务
 *   npm run open    启动服务并打开浏览器（Mac）
 * 访问 http://localhost:3000
 * AI 接口：POST /api/chat
 */
import { createServer } from "node:http";
import { readFile, existsSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const API_MODEL = "glm-5.1";
const API_MAX_TOKENS = 65536;
const API_TEMPERATURE = 1.0;
const ZHIPU_API_KEY = "9fb296d930ca4971a9711c228de6a687.YoRkxfRHflVphqdp";

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

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getApiKey() {
  const key = ZHIPU_API_KEY.trim();
  if (!key) throw new Error("请在 chat.js 中填写 ZHIPU_API_KEY");
  return key;
}

function filterMessages(messages) {
  if (!Array.isArray(messages)) {
    throw new Error("messages 必须是数组");
  }
  const chatMessages = messages.filter(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim()
  );
  if (!chatMessages.length) {
    throw new Error("messages 不能为空");
  }
  return chatMessages;
}

async function callZhipu(chatMessages) {
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
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new Error(`无法连接智谱 API：${err.message || "请检查网络后重试"}`);
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    throw new Error("智谱 API 返回了无法解析的响应");
  }

  if (!upstream.ok) {
    const message =
      data?.error?.message || data?.message || data?.msg || `模型请求失败（${upstream.status}）`;
    const err = new Error(message);
    err.status = upstream.status === 401 ? 401 : upstream.status >= 500 ? 502 : upstream.status;
    throw err;
  }

  const message = data?.choices?.[0]?.message;
  const content = (message?.content || message?.reasoning_content || "").trim();
  if (!content) {
    throw new Error("模型未返回有效内容");
  }
  return content;
}

function sendJson(res, status, payload, cors = false) {
  if (cors) setCors(res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("请求体过大"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function handleChat(req, res) {
  let parsed;
  try {
    parsed = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: "请求体必须是合法 JSON" }, true);
  }

  try {
    const chatMessages = filterMessages(parsed.messages);
    const content = await callZhipu(chatMessages);
    return sendJson(res, 200, { content }, true);
  } catch (err) {
    const status = err.status || (err.message?.includes("messages") ? 400 : 500);
    return sendJson(res, status, { error: err.message }, true);
  }
}

function serveStatic(pathname, res) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(ROOT, safePath);

  if (!filePath.startsWith(ROOT) || !existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }

  const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
  readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("读取文件失败");
      return;
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/health" && req.method === "GET") {
      return sendJson(res, 200, { ok: true }, true);
    }

    if (url.pathname === "/api/chat" && req.method === "OPTIONS") {
      setCors(res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      await handleChat(req, res);
      return;
    }

    if (req.method === "GET") {
      serveStatic(url.pathname, res);
      return;
    }

    sendJson(res, 405, { error: "Method Not Allowed" }, true);
  }).listen(PORT, () => {
    console.log(`本地站点: http://localhost:${PORT}`);
    console.log("AI 接口: POST /api/chat");
  });
}
