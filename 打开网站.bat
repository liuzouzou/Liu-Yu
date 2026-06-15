@echo off
cd /d "%~dp0"
set PORT=3000
set URL=http://127.0.0.1:%PORT%/

where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js，请先安装：https://nodejs.org
  pause
  exit /b 1
)

node sync-api-key.js 2>nul

netstat -ano | findstr ":%PORT% " | findstr LISTENING >nul
if errorlevel 1 (
  start /b node local-server.js >> server.log 2>&1
  timeout /t 2 /nobreak >nul
)

start "" "%URL%"
