import { createServer } from "node:http";
import { readFile, readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
// 与 apikey.md 文档一致
const API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const API_MODEL = "glm-5.1";
const API_MAX_TOKENS = 65536;
const API_TEMPERATURE = 1.0;

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

let cachedApiKey = null;

function loadApiKey() {
  if (process.env.ZHIPU_API_KEY?.trim()) {
    return process.env.ZHIPU_API_KEY.trim();
  }

  const keyPath = join(ROOT, "apikey.md");
  if (!existsSync(keyPath)) {
    throw new Error(
      "缺少 API Key：请设置环境变量 ZHIPU_API_KEY，或在 apikey.md 第一行填写 Key"
    );
  }

  const raw = readFileSync(keyPath, "utf8").trim();
  if (!raw) {
    throw new Error("apikey.md 为空，请将智谱 API Key 写在第一行并保存文件");
  }

  const line = raw
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("curl") && !l.startsWith("{") && !l.startsWith("-"));

  if (!line) {
    throw new Error("apikey.md 中未找到有效的 API Key（请仅将 Key 写在第一行）");
  }

  return line;
}

function getApiKey() {
  if (!cachedApiKey) {
    cachedApiKey = loadApiKey();
  }
  return cachedApiKey;
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

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendApiJson(res, status, payload) {
  setCors(res);
  sendJson(res, status, payload);
}

async function handleChat(req, res) {
  let parsed;
  try {
    parsed = JSON.parse(await readBody(req));
  } catch {
    sendApiJson(res, 400, { error: "请求体必须是合法 JSON" });
    return;
  }

  const { messages } = parsed;
  if (!Array.isArray(messages)) {
    sendApiJson(res, 400, { error: "messages 必须是数组" });
    return;
  }

  const chatMessages = messages.filter(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim()
  );

  if (!chatMessages.length) {
    sendApiJson(res, 400, { error: "messages 不能为空" });
    return;
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
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (err.message?.includes("API Key")) {
      sendApiJson(res, 500, { error: err.message });
      return;
    }
    console.error("智谱 API 请求失败:", err);
    sendApiJson(res, 502, {
      error: `无法连接智谱 API：${err.message || "请检查网络后重试"}`,
    });
    return;
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    sendApiJson(res, 502, { error: "智谱 API 返回了无法解析的响应" });
    return;
  }

  if (!upstream.ok) {
    const message =
      data?.error?.message || data?.message || data?.msg || `模型请求失败（${upstream.status}）`;
    const status = upstream.status === 401 ? 401 : upstream.status >= 500 ? 502 : upstream.status;
    sendApiJson(res, status, { error: message });
    return;
  }

  const message = data?.choices?.[0]?.message;
  const content = (message?.content || message?.reasoning_content || "").trim();
  if (!content) {
    sendApiJson(res, 502, { error: "模型未返回有效内容" });
    return;
  }

  sendApiJson(res, 200, { content });
}

function serveStatic(pathname, res) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  if (!existsSync(filePath)) {
    sendJson(res, 404, { error: "Not Found" });
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";

  readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 500, { error: "读取文件失败" });
      return;
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/health" && req.method === "GET") {
    sendApiJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/chat" && req.method === "OPTIONS") {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    try {
      await handleChat(req, res);
    } catch (err) {
      sendApiJson(res, 500, { error: err.message || "服务器内部错误" });
    }
    return;
  }

  if (req.method === "GET") {
    serveStatic(url.pathname, res);
    return;
  }

  sendJson(res, 405, { error: "Method Not Allowed" });
}).listen(PORT, () => {
  try {
    execSync("node sync-api-key.js", { cwd: ROOT, stdio: "ignore" });
  } catch {
    /* 无 apikey.md 时跳过 */
  }
  console.log(`站点已启动: http://localhost:${PORT}`);
  console.log("AI 对话接口: POST /api/chat");
});
