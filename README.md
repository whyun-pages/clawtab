# ClawTab

运行在 Chrome 插件环境中的浏览器自动化助手原型。

## 已实现能力

- TypeScript + ESM + Vite 构建的 Manifest V3 扩展骨架
- `background` / `content script` / `popup`（兼 side panel）三个入口
- 通过 Mozilla Readability + NodeHtmlMarkdown 抽取页面正文为 markdown
- 基于 AI SDK 的 OpenAI 兼容大模型接入，支持流式输出、思考过程与工具调用
- 内置 `tabSnapshotListBasicTool` / `tabSnapshotGet` 两个工具，由 system prompt 强制按顺序调用
- 多会话支持：会话与消息持久化到 IndexedDB，配置持久化到 `chrome.storage.local`
- popup 支持 markdown 渲染、统一的活动容器（思考过程 + 工具调用）、消息复制、流式传输中断、Enter / Shift+Enter 快捷键
- Sentry Browser SDK 错误上报
- `vitest` 单元测试 + `playwright` 端到端脚手架

## 项目文档

- 架构说明：`docs/architecture.md`
- 代码参考：`docs/code-reference.md`
- 消息协议：`docs/background-message-protocol.md`
- 流式时序：`docs/streaming-chat-sequence.md`

## 本地开发

```bash
pnpm install
pnpm build
```

构建产物在 `dist/`，可在 Chrome 扩展管理页以"加载已解压的扩展程序"方式加载。`pnpm build` 会跑两次 Vite：第一次产出 popup、background 与静态资源，第二次以 `--mode content` 产出 `content.js`。

## 常用命令

```bash
pnpm build            # 完整构建
pnpm dev              # 监听模式构建（popup + background）
pnpm dev:content      # 监听模式构建 content script
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm test             # vitest 单元测试
pnpm test:e2e         # playwright 端到端测试
pnpm package:chrome   # 构建后打 zip 到 releases/
```

Sentry DSN 通过环境变量 `VITE_SENTRY_DSN` 注入，可参考根目录的 `.env.example`。

## 大模型配置

在 popup 设置面板填写 OpenAI 兼容接口的 Base URL、API Key 与 Model 名称。建议从一个本地兼容 gateway（如 `http://127.0.0.1:18789/v1`）入手验证。

### 验证 chat completions 接口

拿到 API Key 后，可对 `POST <Base URL>/chat/completions` 做冒烟测试。请求体与 OpenAI Chat Completions 一致（JSON：`model`、`messages`，其中每条为 `role` + `content`）。与插件行为一致（见 `src/background/llm-gateway.ts`），请求头包含：

- `Authorization: Bearer <API Key>`

将下面示例里的 `YOUR_API_KEY` 换成真实 API Key。

#### 使用 curl

```bash
curl -sS -X POST "http://127.0.0.1:18789/v1/chat/completions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openclaw/default",
    "messages": [
      { "role": "user", "content": "你好，简单自我介绍一下。" }
    ]
  }'
```

若 Gateway 启用了 SSE，可验证流式响应（使用 `-N` 以便实时打印 chunked 响应）：

```bash
curl -sS -N -X POST "http://127.0.0.1:18789/v1/chat/completions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openclaw/default",
    "stream": true,
    "messages": [
      { "role": "user", "content": "用一句话说明你能做什么。" }
    ]
  }'
```

在 Windows 上请在 PowerShell 中使用 **`curl.exe`**（避免 `curl` 被解析为 `Invoke-WebRequest` 别名），或在 Git Bash / WSL 中执行上述命令。

#### 使用 PowerShell

```powershell
$headers = @{
  Authorization = "Bearer YOUR_API_KEY"
  "Content-Type" = "application/json"
}

$body = @{
  model = "openclaw/default"
  messages = @(
    @{
      role = "user"
      content = "你好"
    }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:18789/v1/chat/completions" -Headers $headers -Body $body
```

## 注意事项

- 插件需要 `tabs` 权限来下发 `url-changed` 通知和清理已关闭标签页的快照
- 标签页快照按 URL 索引并持久化到 `chrome.storage.local`，service worker 启动时会过滤掉已关闭的标签页
- 大模型每轮最多 5 个 step（`stopWhen: stepCountIs(5)`），其中 step 0 / step 1 被强制要求调用工具

## TODO

- [x] 持久化聊天历史与扩展配置（IndexedDB + `chrome.storage.local`）
- [x] 多会话管理
- [x] markdown 渲染
- [x] 复制问题和答案
- [x] 流式输出 + 思考过程展示
- [x] 工具调用：标签页列表 / 标签页正文
- [ ] 接入更多工具（搜索、剪贴板、跨页操作、字幕抓取等）
- [ ] 完善真实的 Playwright 扩展加载与交互测试
- [ ] 持久化长期记忆
- [ ] 视频 / 音频专用 extractor
- [ ] 定时任务
