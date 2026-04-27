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
- `background` 会把聊天历史和 connector 配置持久化到 `chrome.storage.local`
- connector 会先判断是否命中 `shopping` / `social` / `video` skill，再把标签页摘要、skill 判定和会话历史一起发给 OpenClaw Gateway
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

可先在 PowerShell 里手动验证 Gateway：

```powershell
$headers = @{
  Authorization = "Bearer YOUR_TOKEN"
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

## 后续建议

- 为三类 skill 接入真实站点自动化与结构化提取
- 在 `chrome.storage` 中持久化聊天历史与标签页快照
- 完善真实的 Playwright 扩展加载与交互测试
