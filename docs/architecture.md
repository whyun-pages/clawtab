# ClawTab 架构文档

## 项目定位

ClawTab 是一个运行在 Chrome 插件环境中的浏览器自动化助手原型。它的核心目标是：

- 从当前浏览器标签页提取页面正文
- 在插件 popup / side panel 中以多会话方式与用户对话
- 由大模型按需调用工具读取当前标签页内容，作为回答依据
- 支持流式输出、思考过程展示和工具调用渲染

当前项目以 Chrome Extension Manifest V3 为基础，代码使用 TypeScript + ESM 编写，构建工具为 Vite。

## 整体架构

项目由三个主要运行入口组成：

- `content script`
- `background service worker`
- `popup`（同时作为 side panel 页面）

它们的职责分工如下：

### 1. `content script`

位置：`src/content/index.ts`

职责：

- 通过 `ContentExtractor` 抽象类提取页面正文（默认实现走 Mozilla Readability + NodeHtmlMarkdown，把正文转成 Markdown）
- 把 `title`、`url`、正文 markdown 上报给 `background`
- 监听 `load` / `visibilitychange` / `popstate` / `hashchange` 以及 background 下发的 `url-changed`，按需重新上报快照

抽取实现位置：`src/content/content-extractor/`，工厂入口：`extractor-factory.ts`，可基于 URL 选择不同的实现，目前默认使用 `DefaultContentExtractor`。

### 2. `background service worker`

位置：`src/background/index.ts`

职责：

- 注册并分发 `chrome.runtime.onMessage` 消息（通过 handler 工厂）
- 注册并分发 `chrome.runtime.onConnect` 长连接（专用 Port：`chat/stream`）
- 维护当前标签页快照缓存，并持久化到 `chrome.storage.local`
- 调用 connector 拼装上下文并通过 AI SDK 访问大模型
- 通过 IndexedDB 持久化会话、消息与当前会话 ID
- 监听 `tabs.onRemoved` 清理快照，`tabs.onUpdated` 下发 `url-changed` 让 content script 刷新内容

这是整个扩展的中枢。具体的消息分发由 `src/background/handlers/factory.ts` 完成，每种消息对应一个独立 handler 文件。

### 3. `popup`

位置：`src/popup/index.ts`

popup 同时作为 Manifest 中 `action.default_popup` 与 `side_panel.default_path` 的入口。

职责：

- 展示聊天消息列表（流式追加 + 完成后用历史对齐）
- 提供会话面板（创建 / 切换 / 重命名 / 删除）
- 提供大模型设置面板
- 渲染 assistant 的工具调用与思考过程
- Markdown 渲染（marked + DOMPurify）
- 提供消息复制按钮、Enter 发送 / Shift+Enter 换行的快捷键

`popup` 不直接调用大模型接口，而是统一走 `background`。

## 核心数据流

### 页面快照链路

1. 用户打开网页
2. `content script` 等待 DOM 稳定后用 Readability 提取正文，再转成 markdown
3. 通过 `chrome.runtime.sendMessage` 发送 `content/snapshot`
4. `background` 用 `sender.tab?.id` 补齐 `tabId`，将快照同时写入内存 Map 与 `chrome.storage.local`
5. 标签页 URL 变化时 `background` 主动给 content script 下发 `url-changed`，content script 重新上报
6. 标签页关闭时 `background` 收到 `tabs.onRemoved`，移除对应快照

快照以 `url` 作为主键，同一 URL 上的多个 tab 会复用同一份快照。

### 聊天链路（流式）

1. 用户在 popup 输入消息并发送
2. popup 建立 `chat/stream` Port，立即在本地插入 user 消息和一个空 assistant 占位
3. popup 通过 Port 发送 `chat/stream:start`
4. `background` 读取当前会话历史、配置、标签页快照列表
5. `background` 回送 `chat/stream:started`，对齐占位消息 ID
6. `runConnectorStream` 构造 system prompt 与 messages，调用 `streamLlm`
7. AI SDK 边生成边触发 `text-delta` / `reasoning-delta` / `tool-*` 事件
   - `<think>...</think>` 文本段由 `ThinkTagParser` 提取为 `reasoning`
   - 工具调用通过 `gatewayTools` 在 background 进程内执行
8. background 把增量按 `answer` / `reasoning` / `tool` 转发为 `chat/stream:delta`
9. 流结束后 background 把 user 消息和完整 assistant 消息写入 IndexedDB
10. background 发送 `chat/stream:done` 携带完整 history，popup 用其对齐本地状态

非流式接口 `chat/send` 仍保留，但 popup 默认走流式。

### 会话管理链路

1. popup 启动时调用 `chat/state:get` 拿到当前会话历史、当前 `sid`、会话列表与配置
2. 会话面板独立调用 `session/list` / `session/create` / `session/switch` / `session/delete` / `session/rename`
3. 切换 / 新建 / 删除会话后，popup 重新拉取 chat state 并重渲染
4. background 通过 IndexedDB 的 `meta` 表持久化当前 `sid`

### 配置链路

1. 用户在设置面板填写 Base URL / API Key / Model
2. popup 发送 `config/save`
3. `background` 调用 `storage.ts` 进行归一化与持久化
4. 后续聊天请求复用同一份配置

## Connector 设计

位置：`src/background/connector.ts`

connector 负责把“当前上下文”转换成一次可发送给大模型的请求。它目前做四件事：

1. 调用 `decideSkill` 做关键词 skill 判定（结果带回 popup，但不影响 system prompt）
2. 根据用户问题对标签页快照打分，挑选前 3 个最相关的（仅作为返回结果展示）
3. 通过 `buildSystemPrompt()`（位置：`src/ai/prompt/system-prompt.ts`）生成 system prompt，强制要求大模型先调用工具读取标签页内容
4. 通过 `requestLlm` / `streamLlm` 调用 AI SDK

如果配置不完整，connector 直接返回“请先配置 Gateway”的引导文案，不会发请求。

## 工具调用

位置：`src/ai/tools/`

当前向大模型暴露两个工具：

- `tabSnapshotListBasicTool`：列出所有标签页的 URL 和标题
- `tabSnapshotGet`：根据 `tabUrl` 返回该页面的完整正文

System prompt 强制要求大模型按以下流程执行：

1. 首步必须调用 `tabSnapshotListBasicTool`
2. 若结果为空，回复用户“标签页数据为空”
3. 否则挑选最相关 URL 调用 `tabSnapshotGet`
4. 最终基于工具返回的正文回答

`llm-gateway.ts` 中通过 `prepareStep` 在 step 0 / step 1 上强制选择对应工具，从 step 2 起允许 `toolChoice: 'auto'`，并在 `stopWhen: stepCountIs(5)` 内结束。

## Skill 判定机制

位置：`src/background/skills.ts`

`decideSkill` 仍然是关键词匹配（`shopping` / `social` / `video`），结果会随 `ConnectorResult` 返回给 popup，但不再注入 prompt。`runSkill` 是占位实现，没有接入主链路。

## 大模型接入方式

位置：`src/background/llm-gateway.ts`

通过 [`@ai-sdk/openai-compatible`](https://www.npmjs.com/package/@ai-sdk/openai-compatible) + [`ai`](https://www.npmjs.com/package/ai) 接入 OpenAI 兼容的接口：

- 走 AI SDK 的 `generateText` / `streamText`
- 模型由 `provider.chatModel(config.model)` 创建
- 工具集合统一注册到 `gatewayTools`
- 流式输出通过 `result.fullStream` 解析 `text-delta` / `reasoning-delta` / `tool-call` / `tool-input-*` / `tool-result` / `tool-error`
- `<think>...</think>` 文本段额外由 `ThinkTagParser` 解析为 reasoning，兼容 MiniMax 等模型

## 状态管理

### 1. 内存态

位置：`src/background/tab-content-store.ts`

- 通过 `Map<TabUrl, PageSnapshot>` 缓存当前活跃 URL 的页面快照
- 维护 `tabId ↔ url` 双向索引，支持按 tab 关闭清理
- service worker 启动时调用 `loadSnapshotsFromLocalStorage()` 把存储中的快照回填到内存

### 2. `chrome.storage.local`

- 大模型配置：键 `llm-config`
- 页面快照：键前缀 `tab-content-store-<url>`
- 旧版 `chat-history` 键会在 `onInstalled` / `onStartup` 时被清理

### 3. IndexedDB

位置：`src/background/idb.ts`、`session-store.ts`、`message-store.ts`

- 数据库：`clawtab`，版本 `1`
- Object stores：
  - `sessions`（key: `sid`），按 `updatedAt` 建索引
  - `messages`（key: `cid`），按 `sid`、`[sid, seq]` 建索引
  - `meta`（key: `key`），用于保存 `currentSid`
- 消息以追加方式写入，`seq` 单调递增；切换会话只换 `currentSid`
- 删除会话会级联清空对应消息；删除最后一个会话时自动创建一个新的欢迎会话

## 构建方式

构建工具：Vite。`package.json` 中 `build` 脚本会跑两次构建：

```jsonc
"build": "vite build && vite build --mode content"
```

- 第一次（默认 mode）以 `popup.html` 与 `src/background/index.ts` 为入口，产出 popup HTML/JS、styles.css 与 `background.js`，并复制 `public/` 静态资源（包含 `manifest.json` / `icons/`）
- 第二次（`--mode content`）以 `src/content/index.ts` 为入口，按 IIFE 输出 `content.js`，并在 `dist/` 上做增量

打包发布：`pnpm package:chrome` 调用 `scripts/package-extension.mjs` 生成 zip 到 `releases/`。

## 测试策略

`vitest` 是主力测试框架，位置：`tests/`，已覆盖：

- `connector.test.ts`：skill 判定与 connector 行为
- `background-handler-factory.test.ts`：handler 工厂分发
- `think-tag-parser.test.ts`：`<think>` 标签解析
- `content-send-message.test.ts`：content script 发送重试与 context invalidated 处理
- `popup-chat-state.test.ts` / `popup-chat-stream-controller.test.ts` / `popup-message-view.test.ts` / `popup-tool-renderers.test.ts` / `popup-chat-shortcut.test.ts`：popup 关键模块

`playwright` 位于 `tests/e2e/`，仍是脚手架级别，尚未覆盖真实扩展 UI 交互。

## 当前限制

- 标签页快照只持久化在本地，没有过期策略
- skill 仍然只做判定，没有真正的自动化能力
- popup UI 仍是原型级实现
- 工具集合仅有读快照的两个工具，没有“跨页操作”类工具
- 没有持久化记忆 / 长期上下文压缩

## 推荐后续演进方向

- 扩展工具集（如：搜索、写入剪贴板、跨页操作、字幕抓取等）
- 给标签页快照增加 TTL 与差异化提取策略（视频、社交、商品）
- 完善真实 Playwright 扩展端到端用例
- 拆分更细的 system prompt 模板与工具描述
- 引入长期记忆 / 跨会话的知识沉淀
