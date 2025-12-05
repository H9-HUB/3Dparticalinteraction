<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/1

## Run Locally

**Prerequisites:**  Node.js

## 部署到 Vercel 的 MediaPipe 资源问题

为避免中国大陆环境下 CDN/Google 存储不可达导致 MediaPipe 初始化超时，项目已将 MediaPipe 的 wasm 与 `hand_landmarker.task` 模型改为同源托管：

- 构建/安装时，脚本会把 `@mediapipe/tasks-vision/wasm` 复制到 `public/mediapipe/wasm`，并下载手部模型到 `public/mediapipe/models/hand_landmarker.task`。
- 运行时，`services/vision.ts` 通过同源路径加载这些资源，避免外网依赖。

如需本地运行：

```powershell
npm install
npm run dev
```

如需构建部署：

```powershell
npm run build
```

如果在 Vercel 构建日志中看到模型下载失败的警告，请检查网络，或手动将模型文件放到 `public/mediapipe/models/hand_landmarker.task` 后重试构建。

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
