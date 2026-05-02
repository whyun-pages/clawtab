# ClawTab

运行在 Chrome 插件环境中的浏览器自动化助手原型。

## 已初始化内容

- TypeScript + ESM 工程
- Manifest V3 Chrome 扩展骨架
- `background` / `content script` / `popup` 三个入口
- 简化版 openclaw connector 与内置 skills 调度规则
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
- `popup` 提供聊天界面和 OpenClaw Gateway 配置表单
- 当前真实接入的是 OpenClaw 的 OpenAI 兼容接口：`POST /v1/chat/completions`

## OpenClaw Gateway 配置

需要先在 OpenClaw 侧启用 HTTP Chat Completions 接口，并准备 Gateway Token。

典型配置项如下：

```json
{
  "gateway": {
    "http": {
      "endpoints": {
        "chatCompletions": {
          "enabled": true
        }
      }
    }
  }
}
```

插件中的默认连接参数：

- Base URL: `http://127.0.0.1:18789/v1`
- Model: `openclaw/default`
- Agent ID: `main`

### 验证 chat completions 接口

启用 Gateway 并拿到 Token 后，可对 `POST <Base URL>/chat/completions` 做冒烟测试。请求体与 OpenAI Chat Completions 一致（JSON：`model`、`messages`，其中每条为 `role` + `content`）。与插件行为一致（见 `src/background/openclaw-gateway.ts`），请求头建议同时包含：

- `Authorization: Bearer <Gateway Token>`
- `x-openclaw-agent-id`：与上方 Agent ID 一致（默认 `main`）
- `x-openclaw-session-key`：任意字符串，用于同一会话上下文；插件侧会生成类似 `clawtab-<uuid>` 的值

将下面示例里的 `YOUR_TOKEN` 换成真实 Token。

#### 使用 curl

```bash
curl -sS -X POST "http://127.0.0.1:18789/v1/chat/completions" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-openclaw-agent-id: main" \
  -H "x-openclaw-session-key: clawtab-dev-session" \
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
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-openclaw-agent-id: main" \
  -H "x-openclaw-session-key: clawtab-dev-session" \
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
  Authorization = "Bearer YOUR_TOKEN"
  "Content-Type" = "application/json"
  "x-openclaw-agent-id" = "main"
  "x-openclaw-session-key" = "clawtab-dev-session"
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

- 为三类 skill 接入真实站点自动化与结构化提取
- 在 `chrome.storage` 中持久化聊天历史与标签页快照
- 完善真实的 Playwright 扩展加载与交互测试
- `background` 会把聊天历史和 connector 配置持久化到 `chrome.storage.local`
- connector 会先判断是否命中 `shopping` / `social` / `video` skill，再把标签页摘要、skill 判定和会话历史一起发给 OpenClaw Gateway
