# 刘宇个人网站

静态个人主页 + AI 对话。本地开发用 `local-server.js`，线上部署用 Vercel 静态托管 + Serverless API。

## 本地运行

```bash
npm run setup   # 将 apikey.md 同步到 api-local.js（仅本地）
npm start       # http://localhost:3000
```

## 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 [Vercel](https://vercel.com) 导入该仓库
3. **Framework Preset** 选择 **Other**（不要选 Node.js Server）
4. **Build Command** 留空，**Output Directory** 留空
5. 在 **Settings → Environment Variables** 添加：
   - `ZHIPU_API_KEY` = 你的智谱 API Key
6. 重新部署

## 推送到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/lzouzou_web.git
git push -u origin main
```

> `apikey.md`、`api-local.js` 已在 `.gitignore` 中，不会上传到 GitHub。
