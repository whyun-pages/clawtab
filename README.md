# ClawTab

运行在 Chrome 插件环境中的浏览器自动化助手原型。

## 已初始化内容

- TypeScript + ESM 工程
- Manifest V3 Chrome 扩展骨架
- `background` / `content script` / `popup` 三个入口
- 简化版 LLM connector 与内置 skills 调度规则
- `vitest` 单元测试
- `playwright` 端到端测试脚手架

## 项目文档

- 架构说明：`docs/architecture.md`
- 代码参考：`docs/code-reference.md`
- 消息协议：`docs/background-message-protocol.md`

## 本地开发

```powershell
pnpm install
pnpm build
```

构建后产物在 `dist/`，可在 Chrome 扩展管理页以“加载已解压的扩展程序”方式加载。

## 常用命令

```powershell
pnpm build
pnpm dev
pnpm typecheck
pnpm test
pnpm test:e2e
```

## 当前实现说明

- `content script` 会抓取页面标题、URL 和正文片段并上报给 `background`
- `popup` 提供聊天界面和大模型配置表单
- 当前真实接入 OpenAI-compatible Chat Completions 接口：`POST /v1/chat/completions`

## 大模型配置

需要准备兼容 OpenAI Chat Completions 的 Base URL、API Key 和模型名。

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

## TODO

- [ ] connector 会先判断是否命中 `shopping` / `social` / `video` skill，再把标签页摘要、skill 判定和会话历史一起发给大模型接口
- [ ] 完善真实的 Playwright 扩展加载与交互测试
- [x] `background` 会把聊天历史和 connector 配置持久化到 `chrome.storage.local`
- [ ] 会话管理
- [ ] 持久记忆
- [x] markdown 渲染
- [ ] 复制问题和答案
