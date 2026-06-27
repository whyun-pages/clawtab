# ClawTab Background 消息协议

## 目的

本文档说明 `background service worker` 当前对外暴露的消息协议。

适用对象：

- `popup`（包含 side panel 入口）
- `content script`
- 后续需要复用同一协议的其他扩展端 UI

协议实现位置：

- 消息类型定义：`src/shared/types.ts`
- 消息分发入口：`src/background/index.ts`
- 各类型 handler：`src/background/handlers/*.handler.ts`，由 `handlers/factory.ts` 统一注册分发

## 总览

当前 `background` 通过 `chrome.runtime.onMessage` 处理以下消息：

- `content/snapshot`
- `chat/send`
- `chat/state:get`
- `config/get`
- `config/save`
- `session/list`
- `session/create`
- `session/switch`
- `session/delete`
- `session/rename`

同时通过 `chrome.runtime.onConnect` 暴露以下长连接：

- `chat/stream`

其中：

- `content/snapshot` 主要由 `content script` 发送
- 其余消息和 `chat/stream` 主要由 `popup` 发送

> 旧版的 `chat/state:reset` 已经被会话相关的 `session/*` 消息取代。

## 设计约定

### 1. 使用 `type` 作为消息分发键

所有请求消息都带有 `type` 字段，`background/handlers/factory.ts` 按 `type` 查表分发。

### 2. 成功响应统一带 `ok: true`

当前已实现的响应对象都遵循这个约定。

注意：

- 目前还没有统一的 `ok: false` 错误响应结构
- 一次性消息若抛出异常，调用方会在 `chrome.runtime.sendMessage()` 侧收到异常

### 3. 异步消息返回 `true`

`background/index.ts` 的 `onMessage` 监听器若 handler 返回 Promise，会自动 `return true` 以保持消息通道打开，等 Promise 完成后再调用 `sendResponse`。

### 4. 页面快照请求由 `background` 补全 `tabId`

`content script` 无需提供 `tabId`，`background` 会使用 `sender.tab?.id` 进行补齐，这样能避免前端伪造或错误传递标签页标识。

## 消息定义

### `content/snapshot`

用途：上报当前页面的轻量快照（正文已由 Readability 抽取并转成 markdown）。

发送方：`content script`

请求结构：

```ts
{
  type: "content/snapshot",
  snapshot: {
    url: string,
    title: string,
    text: string,
    updatedAt: number
  }
}
```

说明：

- `snapshot` 实际类型是 `Omit<PageSnapshot, "tabId">`
- `tabId` 由 `background` 根据 `sender.tab?.id` 注入

处理流程：

1. `background` 校验 `sender.tab?.id`
2. 如果没有有效 `tabId`，直接忽略
3. 如果存在，则写入 `tabContentStore`（内存 + `chrome.storage.local`）

响应：

```ts
{ ok: true }
```

### `chat/send`

用途：发起一次非流式聊天请求（保留作为兼容，popup 默认走 `chat/stream`）。

发送方：popup

请求结构：

```ts
{
  type: "chat/send",
  message: string
}
```

处理流程：

1. 读取大模型配置、当前 `sid` 及该会话历史
2. 调用 `runConnector()`
3. 通过 `appendMessages()` 把 user 和 assistant 消息写入 IndexedDB
4. 返回最新结果和当前会话完整历史

响应结构：

```ts
{
  ok: true,
  result: {
    reply: string,
    reasoning?: string,
    toolCalls?: ToolStreamDelta[],
    decision: {
      skill: "shopping" | "social" | "video" | null,
      reason: string
    },
    relatedTabs: PageSnapshot[],
    mode: "gateway" | "config-required"
  },
  history: ChatMessage[]
}
```

字段说明：

- `result.reply`：最终返回给前端显示的文本
- `result.reasoning`：可选，模型返回的思考内容
- `result.toolCalls`：可选，本轮完成的工具调用（仅 `result` / `error` 事件会保留）
- `result.decision`：skill 判定结果，仅供 UI 展示
- `result.relatedTabs`：根据用户问题打分挑出的相关标签页（最多 3 条）
- `result.mode`：
  - `gateway`：已成功走真实大模型接口
  - `config-required`：未完成配置，返回的是引导文案
- `history`：写入存储后的当前会话完整历史

### `chat/stream`

用途：发起一次流式聊天请求，popup 在大模型生成过程中持续收到 assistant 文本、思考增量与工具调用事件。

连接方式：

```ts
const port = chrome.runtime.connect({ name: "chat/stream" });
```

客户端首条消息：

```ts
{
  type: "chat/stream:start",
  requestId: string,
  message: string
}
```

服务端事件：

```ts
{
  type: "chat/stream:started",
  requestId: string,
  assistantMessageId: string
}
```

```ts
{
  type: "chat/stream:delta",
  requestId: string,
  deltaType: "answer" | "reasoning",
  delta: string
}
```

```ts
{
  type: "chat/stream:delta",
  requestId: string,
  deltaType: "tool",
  delta:
    | { event: "call", toolCallId: string, toolName: string, input: unknown }
    | { event: "input-start", toolCallId: string, toolName: string }
    | { event: "input-delta", toolCallId: string, toolName?: string, delta: string }
    | { event: "input-end", toolCallId: string, toolName?: string }
    | { event: "result", toolCallId: string, toolName: string, input: unknown, output: unknown }
    | { event: "error", toolCallId: string, toolName: string, input: unknown, error: unknown }
}
```

字段说明：

- `deltaType: "answer"`：普通回答文本增量
- `deltaType: "reasoning"`：思考过程文本增量
- `deltaType: "tool"`：工具调用过程事件，`delta` 为结构化对象
- 对支持标准 reasoning 事件的 provider，`reasoning` 来自模型的独立 reasoning 流
- 对 MiniMax 等仅在文本中输出思考的模型，`reasoning` 由 `<think>...</think>` 文本段解析得到

```ts
{
  type: "chat/stream:done",
  requestId: string,
  sid: string,
  result: ConnectorResult,
  history: ChatMessage[]
}
```

```ts
{
  type: "chat/stream:error",
  requestId: string,
  message: string
}
```

处理流程：

1. `popup` 建立 `chat/stream` Port 并发送 `chat/stream:start`
2. `background` 读取当前 `sid`、配置、历史与标签页快照
3. `background` 发送 `chat/stream:started`，返回本轮 assistant 消息 ID
4. 大模型生成期间，`background` 多次发送 `chat/stream:delta`
5. 完成后通过 `appendMessages` 写入 user 与完整 assistant 消息，并发送 `chat/stream:done`
6. 请求失败时发送 `chat/stream:error`

断开行为：

- popup 主动断开 Port 时，background 会调用 `AbortController.abort()` 取消正在进行的 AI SDK 请求
- 断开后不再继续 `postMessage`，避免 “Attempted to use disconnected port” 报错

### `chat/state:get`

用途：popup 启动时读取初始化状态。

发送方：popup

请求结构：

```ts
{ type: "chat/state:get" }
```

处理流程：

1. 读取配置
2. 读取当前 `sid` 与对应会话历史
3. 读取会话列表
4. 一并返回

响应结构：

```ts
{
  ok: true,
  history: ChatMessage[],
  config: LlmConfig,
  currentSid: string,
  sessions: Session[]
}
```

使用场景：popup 首次打开、切换会话后重新对齐状态。

### `session/list`

用途：拉取所有会话列表与当前 `sid`。

请求 / 响应：

```ts
{ type: "session/list" }
```

```ts
{
  ok: true,
  sessions: Session[],
  currentSid: string
}
```

### `session/create`

用途：创建新会话并自动切换为当前会话。后台会顺带写入一条欢迎消息。

请求结构：

```ts
{
  type: "session/create",
  title?: string
}
```

响应结构：

```ts
{
  ok: true,
  session: Session,
  history: ChatMessage[],
  currentSid: string
}
```

### `session/switch`

用途：切换当前会话。

请求结构：

```ts
{
  type: "session/switch",
  sid: string
}
```

响应结构：

```ts
{
  ok: true,
  currentSid: string
}
```

切换后 popup 通常会再发 `chat/state:get` 拉取对应历史。

### `session/delete`

用途：删除指定会话。会级联清空该会话所有消息；若删除的是当前会话，会自动切换到剩余最近一个会话；若删除的是最后一个会话，会自动创建一个新的欢迎会话。

请求结构：

```ts
{
  type: "session/delete",
  sid: string
}
```

响应结构：

```ts
{
  ok: true,
  currentSid: string,
  sessions: Session[]
}
```

### `session/rename`

用途：重命名指定会话。空白标题会被回退为原标题。

请求结构：

```ts
{
  type: "session/rename",
  sid: string,
  title: string
}
```

响应结构：

```ts
{
  ok: true,
  session: Session
}
```

### `config/get`

用途：读取当前大模型配置。

请求结构：

```ts
{ type: "config/get" }
```

响应结构：

```ts
{
  ok: true,
  config: LlmConfig
}
```

### `config/save`

用途：保存大模型配置。

请求结构：

```ts
{
  type: "config/save",
  config: {
    baseUrl: string,
    apiKey: string,
    model: string
  }
}
```

处理流程：

1. `background` 调用 `saveConfig()`
2. 对配置做归一化：
   - 去掉 `baseUrl` 尾部斜杠
   - 对 `apiKey`、`model` 做 `trim`
   - 缺省 `model` 时回退到默认值

响应结构：

```ts
{
  ok: true,
  config: LlmConfig
}
```

## 共享类型说明

### `ChatMessage`

```ts
{
  cid: string,                   // 消息主键，IndexedDB keyPath
  sid: string,                   // 所属会话
  role: "user" | "assistant" | "system",
  content: string,
  reasoning?: string,            // assistant 思考过程
  toolCalls?: ToolStreamDelta[], // 本轮已完成的工具调用（仅 result/error）
  createdAt: number,
  seq: number                    // 同一会话内单调递增
}
```

说明：

- popup 一般只展示 `user` 和 `assistant`
- `reasoning` / `toolCalls` 会被持久化，popup 重开后仍能渲染历史思考过程与工具调用结果

### `Session`

```ts
{
  sid: string,
  title: string,
  createdAt: number,
  updatedAt: number
}
```

### `PageSnapshot`

```ts
{
  tabId: number,
  url: string,
  title: string,
  text: string,
  updatedAt: number,
  videoUrl?: string,
  audioUrl?: string,
  subtitles?: string[]
}
```

说明：

- `text` 是 Readability + NodeHtmlMarkdown 抽取的页面正文 markdown
- `videoUrl` / `audioUrl` / `subtitles` 字段为未来扩展预留，当前默认 extractor 不写入

### `LlmConfig`

```ts
{
  baseUrl: string,
  apiKey: string,
  model: string
}
```

说明：

- `baseUrl` 默认空字符串，需要用户自行配置（如 `http://127.0.0.1:18789/v1`）
- `apiKey` 为空时，聊天不会真正访问大模型接口，会返回引导文案

### `ToolStreamDelta`

工具调用过程的结构化事件，详见 `src/shared/types.ts`。常用事件：

- `call`：模型确认一次工具调用（包含完整 `input`）
- `input-start` / `input-delta` / `input-end`：工具参数边生成边推送（部分模型支持）
- `result` / `error`：工具执行结果或错误

`ChatMessage.toolCalls` 与 `ConnectorResult.toolCalls` 中只会出现 `result` / `error` 事件，便于持久化与回放。

## 调用示例

### popup 获取初始状态

```ts
const response = await chrome.runtime.sendMessage({
  type: "chat/state:get"
});
```

### popup 发送非流式聊天消息

```ts
const response = await chrome.runtime.sendMessage({
  type: "chat/send",
  message: "总结一下这个页面"
});
```

### popup 发送流式聊天消息

```ts
const port = chrome.runtime.connect({ name: "chat/stream" });
port.onMessage.addListener((event) => { /* ... */ });
port.postMessage({
  type: "chat/stream:start",
  requestId: crypto.randomUUID(),
  message: "总结一下这个页面"
});
```

### content script 上报页面快照

```ts
await chrome.runtime.sendMessage({
  type: "content/snapshot",
  snapshot: {
    url: location.href,
    title: document.title,
    text: extractedMarkdown,
    updatedAt: Date.now()
  }
});
```

### popup 创建并切换会话

```ts
const response = await chrome.runtime.sendMessage({
  type: "session/create"
});
// response.currentSid 已自动切换为新会话
```

## 当前限制

- 暂无统一错误响应协议（`ok: false`、错误码等）
- 一次性消息没有请求 `id` 或 trace 信息；流式聊天使用 `requestId`
- `content/snapshot` 仅上报正文 markdown，没有结构化 DOM 或资源（视频 / 字幕等）
- 尚未区分内部消息与潜在外部消息来源

## 后续建议

- 为响应补充统一错误结构，例如 `ok: false`、`code`、`message`
- 在协议层加入版本字段，便于后续升级
- 评估是否让更多一次性消息也携带 `requestId`，便于调试和日志追踪
- 把工具调用过程的事件接入持久化（目前只持久化已完成的 `result` / `error`）
