/**
 * 统一入口：
 *   本地：npm start / npm run open → http://localhost:3000
 *   线上：Vercel 将 /api/chat 路由到本文件
 */
import { createServer } from "node:http";
import { readFile, existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const API_MODEL = "glm-5.1";
const API_MAX_TOKENS = 65536;
const API_TEMPERATURE = 1.0;
// 本地可直接用；线上优先读 Vercel 环境变量 ZHIPU_API_KEY
const ZHIPU_API_KEY_FALLBACK = "9fb296d930ca4971a9711c228de6a687.YoRkxfRHflVphqdp";

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

function isVercelRes(res) {
  return typeof res?.status === "function" && typeof res?.json === "function";
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, payload) {
  setCors(res);
  if (isVercelRes(res)) {
    return res.status(status).json(payload);
  }
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function getApiKey() {
  const key = (process.env.ZHIPU_API_KEY || ZHIPU_API_KEY_FALLBACK).trim();
  if (!key) {
    throw new Error(
      "未配置 API Key：本地请填写 ZHIPU_API_KEY_FALLBACK，线上请在 Vercel Environment Variables 添加 ZHIPU_API_KEY"
    );
  }
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

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("请求体过大"));
        req.destroy();
      }
    });
    req.on("end", () => resolveBody(data));
    req.on("error", reject);
  });
}

async function parseMessages(req) {
  if (req.body && typeof req.body === "object") {
    return filterMessages(req.body.messages);
  }
  let parsed;
  try {
    parsed = JSON.parse(await readBody(req));
  } catch {
    throw Object.assign(new Error("请求体必须是合法 JSON"), { status: 400 });
  }
  return filterMessages(parsed.messages);
}

/** Vercel Serverless + 本地共用 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    setCors(res);
    if (isVercelRes(res)) return res.status(204).end();
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method Not Allowed" });
  }

  try {
    const chatMessages = await parseMessages(req);
    const content = await callZhipu(chatMessages);
    return sendJson(res, 200, { content });
  } catch (err) {
    const status =
      err.status ||
      (err.message?.includes("messages") || err.message?.includes("JSON") ? 400 : 500);
    return sendJson(res, status, { error: err.message });
  }
}

function serveStatic(pathname, res) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const rootResolved = resolve(ROOT);
  const filePath = resolve(rootResolved, relative);

  if (!filePath.startsWith(rootResolved + "/") && filePath !== rootResolved) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }

  if (!existsSync(filePath)) {
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
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname === "/api/chat") {
      await handler(req, res);
      return;
    }

    if (req.method === "GET") {
      serveStatic(url.pathname, res);
      return;
    }

    sendJson(res, 405, { error: "Method Not Allowed" });
  }).listen(PORT, () => {
    console.log(`本地站点: http://localhost:${PORT}`);
    console.log("AI 接口: POST /api/chat");
  });
}
