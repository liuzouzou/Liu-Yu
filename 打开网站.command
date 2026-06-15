#!/bin/bash
cd "$(dirname "$0")"
PORT=3000
URL="http://127.0.0.1:${PORT}/"

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "未找到 Node.js" message "请先安装 Node.js：https://nodejs.org"'
  exit 1
fi

node sync-api-key.js 2>/dev/null || true

if ! lsof -ti:"$PORT" >/dev/null 2>&1; then
  nohup node local-server.js >> server.log 2>&1 &
  for _ in $(seq 1 20); do
    sleep 0.3
    if curl -sf "${URL}health" >/dev/null 2>&1; then
      break
    fi
  done
fi

open "$URL"
