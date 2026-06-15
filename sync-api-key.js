import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const keyPath = join(ROOT, "apikey.md");
const outPath = join(ROOT, "api-local.js");

if (!existsSync(keyPath)) {
  console.error("未找到 apikey.md");
  process.exit(1);
}

const line = readFileSync(keyPath, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .find((l) => l && !l.startsWith("curl") && !l.startsWith("{") && !l.startsWith("-"));

if (!line) {
  console.error("apikey.md 第一行未找到有效 API Key");
  process.exit(1);
}

const content = `// 由 sync-api-key.js 自动生成，请勿提交到 Git
window.ZHIPU_CHAT_CONFIG = ${JSON.stringify({ apiKey: line })};\n`;

writeFileSync(outPath, content, "utf8");
console.log("已生成 api-local.js，可直接打开 HTML 自动调用大模型");
