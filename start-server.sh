#!/bin/bash
cd "$(dirname "$0")"
PORT=3000

if lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "服务已在运行: http://127.0.0.1:${PORT}/"
  exit 0
fi

nohup node local-server.js >> server.log 2>&1 &
echo "正在启动…"
for _ in $(seq 1 20); do
  sleep 0.3
  if curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    echo "已启动: http://127.0.0.1:${PORT}/"
    exit 0
  fi
done

echo "启动失败，请查看 server.log"
exit 1
