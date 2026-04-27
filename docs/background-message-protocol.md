# ClawTab Background 消息协议

## 目的

本文档说明 `background service worker` 当前对外暴露的消息协议。

适用对象：

- `popup`
- `content script`
- 后续可能接入的 `side panel`
- 未来需要复用同一协议的其他扩展端 UI

协议实现位置：

- 消息类型定义：`src/shared/types.ts`
- 消息分发入口：`src/background/index.ts`

## 总览

当前 `background` 通过 `chrome.runtime.onMessage` 处理以下消息：

- `content/snapshot`
- `chat/send`
- `chat/state:get`
- `chat/state:reset`
- `config/get`
- `config/save`

其中：

- `content/snapshot` 主要由 `content script` 发送
- 其余消息主要由 `popup` 发送

## 设计约定

### 1. 使用 `type` 作为消息分发键

所有请求消息都带有 `type` 字段，用于 `background` 路由。

### 2. 成功响应统一带 `ok: true`

当前已实现的响应对象都遵循这个约定。

注意：

- 当前还没有统一的 `ok: false` 错误响应结构
- 如果异步流程抛错，调用方会在 `chrome.runtime.sendMessage()` 侧收到异常

### 3. 异步消息返回 `true`

`background` 中凡是需要异步处理并最终调用 `sendResponse()` 的消息分支，都会返回 `true`，以保持消息通道打开。

### 4. 页面快照请求由 `background` 补全 `tabId`

`content script` 无需提供 `tabId`。

`background` 会使用 `sender.tab?.id` 进行补齐，这样能避免前端伪造或错误传递标签页标识。

## 消息定义

### `content/snapshot`

用途：

- 上报当前页面的轻量快照

发送方：

- `content script`

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
3. 如果存在，则写入 `tabContentStore`

当前响应：

```ts
{
  ok: true
}
```

备注：

- 该消息是同步响应，`background` 分支返回 `false`

### `chat/send`

用途：

- 发起一次聊天请求

发送方：

- `popup`

请求结构：

```ts
{
  type: "chat/send",
  message: string
}
```

处理流程：

1. 读取 OpenClaw Gateway 配置
2. 读取已有聊天历史
3. 读取当前标签页快照列表
4. 调用 `runConnector()`
5. 将用户消息和 assistant 回复写回聊天历史
6. 返回最新结果和完整历史

响应结构：

```ts
{
  ok: true,
  result: {
    reply: string,
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
- `result.decision`：skill 判定结果
- `result.relatedTabs`：此次回答参考的相关标签页
- `result.mode`：
  - `gateway`：已成功走真实 OpenClaw Gateway
  - `config-required`：未完成配置，返回的是引导文案
- `history`：写入存储后的完整聊天历史

### `chat/state:get`

用途：

- 读取当前聊天初始化状态

发送方：

- `popup`

请求结构：

```ts
{
  type: "chat/state:get"
}
```

处理流程：

1. 读取配置
2. 读取聊天历史
3. 一并返回

响应结构：

```ts
{
  ok: true,
  history: ChatMessage[],
  config: OpenClawConfig
}
```

使用场景：

- popup 首次打开时初始化页面

### `chat/state:reset`

用途：

- 清空聊天历史

发送方：

- `popup`

请求结构：

```ts
{
  type: "chat/state:reset"
}
```

处理流程：

1. 删除 `chrome.storage.local` 中保存的聊天历史
2. 返回默认欢迎消息
3. 同时返回当前配置

响应结构：

```ts
{
  ok: true,
  history: ChatMessage[],
  config: OpenClawConfig
}
```

注意：

- 当前只会清空聊天历史
- 不会重置 OpenClaw 配置

### `config/get`

用途：

- 读取当前 OpenClaw 配置

发送方：

- `popup`
- 未来可能的设置页或 side panel

请求结构：

```ts
{
  type: "config/get"
}
```

响应结构：

```ts
{
  ok: true,
  config: OpenClawConfig
}
```

### `config/save`

用途：

- 保存 OpenClaw Gateway 配置

发送方：

- `popup`

请求结构：

```ts
{
  type: "config/save",
  config: {
    baseUrl: string,
    token: string,
    model: string,
    agentId: string,
    sessionKey: string
  }
}
```

处理流程：

1. `background` 调用 `saveConfig()`
2. 对配置做归一化：
   - 去掉 `baseUrl` 尾部斜杠
   - 缺省 `model` 时回退到默认值
   - 缺省 `agentId` 时回退到默认值
   - 缺省 `sessionKey` 时自动生成

响应结构：

```ts
{
  ok: true,
  config: OpenClawConfig
}
```

## 共享类型说明

### `ChatMessage`

```ts
{
  id: string,
  role: "user" | "assistant" | "system",
  content: string
}
```

说明：

- `popup` 一般只展示 `user` 和 `assistant`
- `system` 主要给 connector / Gateway 组 prompt 使用

### `PageSnapshot`

```ts
{
  tabId: number,
  url: string,
  title: string,
  text: string,
  updatedAt: number
}
```

说明：

- `tabId` 仅在 `background` 端完整存在
- `text` 是裁剪后的页面正文摘要

### `OpenClawConfig`

```ts
{
  baseUrl: string,
  token: string,
  model: string,
  agentId: string,
  sessionKey: string
}
```

说明：

- `baseUrl` 默认是 `http://127.0.0.1:18789/v1`
- `token` 为空时，聊天不会真正访问 Gateway

## 调用示例

### popup 获取初始状态

```ts
const response = await chrome.runtime.sendMessage({
  type: "chat/state:get"
});
```

### popup 发送聊天消息

```ts
const response = await chrome.runtime.sendMessage({
  type: "chat/send",
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
    text: document.body?.innerText ?? "",
    updatedAt: Date.now()
  }
});
```

## 当前限制

- 暂无统一错误响应协议
- 没有请求版本号字段
- 没有请求 `id` 或 trace 信息
- `content/snapshot` 当前只上报轻量文本，不含结构化 DOM 信息
- 尚未区分内部消息与潜在外部消息来源

## 后续建议

- 为响应补充统一错误结构，例如 `ok: false`、`code`、`message`
- 在协议层加入版本字段，便于后续升级
- 为 `chat/send` 增加可选的流式响应协议
- 给消息增加 `requestId`，便于调试和日志追踪
