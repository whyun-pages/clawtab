# ClawTab 代码参考

## 目录结构

```text
clawtab/
├─ public/
│  └─ manifest.json
├─ icons/
├─ popup.html
├─ scripts/
│  └─ package-extension.mjs
├─ src/
│  ├─ ai/
│  │  ├─ prompt/
│  │  │  └─ system-prompt.ts
│  │  └─ tools/
│  │     ├─ index.ts
│  │     └─ tab-snapshot.tool.ts
│  ├─ background/
│  │  ├─ connector.ts
│  │  ├─ handlers/
│  │  │  ├─ chat-stream-start.handler.ts
│  │  │  ├─ content-snapshot.handler.ts
│  │  │  ├─ factory.ts
│  │  │  ├─ get-chat-state.handler.ts
│  │  │  ├─ get-config.handler.ts
│  │  │  ├─ save-config.handler.ts
│  │  │  ├─ session-create.handler.ts
│  │  │  ├─ session-delete.handler.ts
│  │  │  ├─ session-list.handler.ts
│  │  │  ├─ session-rename.handler.ts
│  │  │  ├─ session-switch.handler.ts
│  │  │  └─ types.ts
│  │  ├─ idb.ts
│  │  ├─ index.ts
│  │  ├─ llm-gateway.ts
│  │  ├─ message-store.ts
│  │  ├─ session-store.ts
│  │  ├─ skills.ts
│  │  ├─ storage.ts
│  │  ├─ tab-content-store.ts
│  │  └─ think-tag-parser.ts
│  ├─ content/
│  │  ├─ content-extractor/
│  │  │  ├─ abstract.extractor.ts
│  │  │  ├─ default.extractor.ts
│  │  │  └─ extractor-factory.ts
│  │  ├─ interfaces/
│  │  │  ├─ content-extractor.interface.ts
│  │  │  └─ index.ts
│  │  ├─ utils/
│  │  │  └─ send-message.ts
│  │  └─ index.ts
│  ├─ lib/
│  │  ├─ logger.ts
│  │  └─ sentry-setup.ts
│  ├─ popup/
│  │  ├─ chat-shortcut.ts
│  │  ├─ chat-state.ts
│  │  ├─ chat-stream-controller.ts
│  │  ├─ config-controller.ts
│  │  ├─ dom.ts
│  │  ├─ index.ts
│  │  ├─ markdown-renderer.ts
│  │  ├─ message-copy.ts
│  │  ├─ message-view-patcher.ts
│  │  ├─ message-view.ts
│  │  ├─ panel.ts
│  │  ├─ session-panel.ts
│  │  ├─ settings-panel.ts
│  │  ├─ styles.css
│  │  └─ tools/
│  │     ├─ abstract-tool.renderer.ts
│  │     ├─ generic-tool.renderer.ts
│  │     ├─ index.ts
│  │     ├─ render-utils.ts
│  │     ├─ tab-snapshot-get.renderer.ts
│  │     └─ tab-snapshot-list-basic.renderer.ts
│  └─ shared/
│     ├─ content.ts
│     ├─ tool-schemas.ts
│     └─ types.ts
├─ tests/
│  ├─ background-handler-factory.test.ts
│  ├─ connector.test.ts
│  ├─ content-send-message.test.ts
│  ├─ popup-chat-shortcut.test.ts
│  ├─ popup-chat-state.test.ts
│  ├─ popup-chat-stream-controller.test.ts
│  ├─ popup-message-view.test.ts
│  ├─ popup-tool-renderers.test.ts
│  ├─ think-tag-parser.test.ts
│  └─ e2e/
├─ docs/
│  ├─ architecture.md
│  ├─ background-message-protocol.md
│  ├─ code-reference.md
│  ├─ streaming-chat-sequence.md
│  └─ store/
├─ vite.config.ts
└─ README.md
```

## 文件职责

### `public/manifest.json`

Chrome 扩展声明文件。负责定义：

- 扩展名称、版本、描述、图标
- 权限：`storage`、`tabs`、`sidePanel`；`host_permissions: <all_urls>`
- `background.service_worker`：`background.js`，`type: module`
- `action.default_popup` 与 `side_panel.default_path`：均指向 `popup.html`
- `content_scripts`：在所有页面注入 `content.js`，`run_at: document_idle`
- `web_accessible_resources`：暴露 `*.map` 给当前页，便于排查

### `popup.html`

popup / side panel 的静态 HTML 壳。包含：

- 顶栏：会话选择、新建会话、设置按钮
- 会话面板（`#session-panel`）：会话列表 + 新建会话按钮
- 设置面板（`#settings-panel`）：Base URL / API Key / Model 表单
- 聊天消息容器（`#messages`）
- 输入区（`#chat-form` + `#chat-input`）

### `scripts/package-extension.mjs`

打包脚本，由 `pnpm package:chrome` 触发。在 `pnpm build` 之后把 `dist/` 压缩成 zip，输出到 `releases/`，方便上传 Chrome Web Store。

### `vite.config.ts`

Vite + Vitest 配置。区分两种构建模式：

- 默认模式：`popup.html` 与 `src/background/index.ts` 为入口，输出 popup、background 与静态资源
- `--mode content`：`src/content/index.ts` 为入口，按 IIFE 输出 `content.js`，并启用 `emptyOutDir: false`

### `src/shared/types.ts`

项目的共享类型中心。主要定义：

- 页面快照：`PageSnapshot` / `PageSnapshotBasicInfo`
- 聊天消息：`ChatMessage`（含 `cid` / `sid` / `seq` / `createdAt` / 可选 `reasoning` 与 `toolCalls`）
- 会话：`Session`
- 大模型配置：`LlmConfig`
- connector 结果：`ConnectorResult`
- 工具流增量：`ToolStreamDelta` 及其子类型
- 各种 runtime 消息及响应：聊天、会话、配置、内容快照
- 流式聊天 Port 协议：`ChatStream*Message`、`CHAT_STREAM_PORT`

这是 `content`、`popup`、`background` 间的协议基础。

### `src/shared/content.ts`

content script 接收的消息类型，目前仅有 `url-changed`。

### `src/shared/tool-schemas.ts`

AI SDK 工具的 zod 输入/输出 schema，被 background 工具实现与 popup 渲染器复用。

## AI 模块

### `src/ai/prompt/system-prompt.ts`

`buildSystemPrompt()` 生成强制工具调用流程的 system prompt。它要求大模型先列出标签页、再按需读取正文，避免凭主观推测回答。

### `src/ai/tools/index.ts`

注册 `gatewayTools`，并通过 `ToolName` 枚举导出工具名常量。

### `src/ai/tools/tab-snapshot.tool.ts`

实现两个工具：

- `tabSnapshotListBasicTool`：调用 `listBasicInfos()` 返回 URL + title 列表
- `tabSnapshotGetTool`：根据 URL 调用 `getSnapshot()` 返回完整快照

## Background 模块

### `src/background/index.ts`

后台入口，负责：

- 注册 `chrome.runtime.onInstalled` / `onStartup`，清理旧版 `chat-history` 键，回填本地存储中的快照
- 通过 handler 工厂分发 `chrome.runtime.onMessage`
- 通过 handler 工厂分发 `chrome.runtime.onConnect`（`chat/stream` Port）
- 监听 `tabs.onRemoved` 清理快照
- 监听 `tabs.onUpdated`，URL 变化时下发 `url-changed`

协议细节参考：`docs/background-message-protocol.md`

### `src/background/handlers/factory.ts`

注册所有消息 handler，并按消息 `type` 分流为 `RuntimeMessageHandler` 或 `StreamMessageHandler`。

### `src/background/handlers/types.ts`

定义 `BackgroundMessageHandler<TMessage, TResult, TContext>` 接口、`RuntimeHandlerContext`（带 `sender`）与 `StreamHandlerContext`（带 `port` / `abortSignal` / `isConnected` / `postToPort`）。

### `src/background/handlers/content-snapshot.handler.ts`

接收 `content/snapshot`，用 `sender.tab?.id` 补齐 `tabId` 后调用 `upsertSnapshot`。

### `src/background/handlers/chat-stream-start.handler.ts`

处理 `chat/stream:start` Port 消息：

- 读取配置、当前 sid 与历史
- 发送 `chat/stream:started` 携带 `assistantMessageId`
- 调用 `runConnectorStream`，把每个 delta 转成 `chat/stream:delta`
- 完成后写入 IndexedDB 并发送 `chat/stream:done`
- 异常时发送 `chat/stream:error`

### `src/background/handlers/get-chat-state.handler.ts`

返回当前 `sid`、对应历史、所有会话与配置，用于 popup 启动初始化。

### `src/background/handlers/get-config.handler.ts` / `save-config.handler.ts`

读写大模型配置。

### `src/background/handlers/session-*.handler.ts`

会话管理：列表、创建、切换、删除、重命名。

### `src/background/idb.ts`

IndexedDB 初始化（基于 [`idb`](https://www.npmjs.com/package/idb)），声明：

- `STORE_SESSIONS`、`STORE_MESSAGES`、`STORE_META` 三个对象仓库
- `INDEX_SESSIONS_BY_UPDATED_AT`、`INDEX_MESSAGES_BY_SID`、`INDEX_MESSAGES_BY_SID_SEQ` 三个索引

### `src/background/session-store.ts`

封装会话 CRUD 与“当前会话”指针：

- `listSessions()` / `createSession()` / `renameSession()` / `deleteSession()` / `resetSession()`
- `getCurrentSid()` / `setCurrentSid()`
- 新建会话时默认追加一条欢迎消息

### `src/background/message-store.ts`

封装消息读写：

- `getMessages(sid)`：按 `[sid, seq]` 升序读取
- `appendMessages(sid, inputs)`：追加消息并更新会话 `updatedAt`
- `clearMessages(sid)`：清空会话消息（删除会话时使用）

### `src/background/tab-content-store.ts`

内存中的标签页快照缓存（按 URL 索引），并把每条快照同步写入 `chrome.storage.local`。对外暴露：

- `upsertSnapshot()` / `removeSnapshot()`
- `loadSnapshotsFromLocalStorage()`：service worker 重启时调用，过滤掉已关闭的标签页
- `listSnapshots()` / `listBasicInfos()` / `getSnapshot(url)`：分别供 connector 和工具使用

### `src/background/storage.ts`

基于 `chrome.storage.local` 的大模型配置持久化：

- `getConfig()` / `saveConfig()`
- 兼容旧字段（如 `token` 自动映射到 `apiKey`）
- 保存时对 `baseUrl` 去尾斜杠、对 `apiKey` 去空格、`model` 缺省回退默认值

### `src/background/skills.ts`

技能判定模块：

- `decideSkill()`：根据关键词判断技能类型，结果随 `ConnectorResult` 返回，但不再注入 prompt
- `runSkill()`：占位实现，未接入主链路

### `src/background/llm-gateway.ts`

AI SDK 网关封装：

- 通过 `@ai-sdk/openai-compatible` 创建 provider
- `streamLlm()` 走 `streamText` 并解析 `text-delta` / `reasoning-delta` / 各种 `tool-*` 事件
- 通过 `prepareStep` 在第 0 / 1 步强制选择 `tabSnapshotListBasicTool` / `tabSnapshotGet`
- 整体步数受 `stopWhen: stepCountIs(5)` 约束
- 透传 `abortSignal`，用于在 Port 断开时取消请求

### `src/background/think-tag-parser.ts`

流式解析 `<think>...</think>` 文本片段，把内部内容转成 `reasoning` delta。兼容 MiniMax 等仅在 text 流中输出思考的模型。

### `src/background/connector.ts`

主流程：

1. `decideSkill()` 做技能判定
2. `selectRelatedTabs()` 在所有快照中按用户问题打分并取前 3
3. 通过 `buildSystemPrompt()` 生成 system prompt
4. 拼上历史（`trimHistory` 截断到 `MAX_HISTORY_LENGTH`）和当前 user 消息
5. 调用 `streamLlm`

未配置 Base URL 或 API Key 时直接返回 `mode: 'config-required'` 的引导文案。

## Content 模块

### `src/content/index.ts`

content script 入口，负责：

- 选择合适的 `ContentExtractor` 实例
- 在 `load` / `visibilitychange` / `popstate` / `hashchange` / `url-changed` 时上报快照
- 通过 `sendMessage` 包装一层重试，处理 “Extension context invalidated” 等可恢复错误
- 捕获 `error` / `unhandledrejection` 上报 Sentry

### `src/content/content-extractor/`

- `abstract.extractor.ts`：抽象基类，提供 `waitForStableDOM` 等待 DOM 稳定（quiet period + 硬超时）的能力
- `default.extractor.ts`：默认实现，先克隆 document 再用 Readability 抽取，最后 `NodeHtmlMarkdown` 转 markdown
- `extractor-factory.ts`：根据 URL 选择实现，目前总是返回 `DefaultContentExtractor`

### `src/content/interfaces/`

`ExtractResult` / `ExtractPayload` 的类型定义。

### `src/content/utils/send-message.ts`

`sendMessage()` 带重试包装；`isExtensionContextInvalidatedError()` 识别扩展重载场景。

## Lib 模块

### `src/lib/logger.ts`

带级别与项目名前缀的轻量 Logger，输出经 `%c` 着色的 DevTools 日志。导出 `defaultLogger`，所有运行入口共享。

### `src/lib/sentry-setup.ts`

Sentry Browser SDK 初始化。MV3 CSP 限制无法用 Loader 形式，所以打包内嵌 SDK，并通过 Proxy 兼容 `window.Sentry` 的旧用法。DSN 走 `import.meta.env.VITE_SENTRY_DSN`，缺省回落到默认 DSN。

## Popup 模块

### `src/popup/index.ts`

popup 启动入口：

- 引入 `sentry-setup` 与样式
- 初始化时拉取 `chat/state:get`
- 挂载会话面板、设置面板、消息复制、聊天表单与快捷键
- 接管发送提交：清空输入框 → 调用 `startChatStream`
- 提供 `refreshChatState` 给会话面板切换后调用

### `src/popup/dom.ts`

集中查询常用 DOM 元素，避免散落的 `querySelector`。

### `src/popup/panel.ts`

通用面板系统：注册面板、互斥打开/关闭、点击外部关闭、Esc 关闭。被 `session-panel` 与 `settings-panel` 复用。

### `src/popup/session-panel.ts`

会话面板逻辑：列表渲染、新建、切换、重命名（双击或点击 ✎）、删除。会话切换后调用 `onSessionChanged` 让外层重渲染消息。

### `src/popup/settings-panel.ts`

挂载设置面板，将表单绑定到 `config-controller`。

### `src/popup/config-controller.ts`

表单与 `config/save` 协议的桥接：`readConfigForm` / `hydrateConfig` / `setConfigStatus` / `buildConfigStatus`。

### `src/popup/chat-state.ts`

popup 端的本地消息缓存。导出对 `ChatMessage` 内容、reasoning、tool calls、cid 的修改函数。

### `src/popup/chat-stream-controller.ts`

负责连接 `chat/stream` Port、维护 `activeRequestId` 与占位 assistant 消息、把 delta 写回缓存并触发实时渲染、在完成/失败时清理资源。

### `src/popup/chat-shortcut.ts`

绑定输入框：Enter 发送，Shift+Enter 换行，输入法 composing 期间不触发。

### `src/popup/message-view.ts`

整列消息渲染入口。`renderMessage` 输出 tool calls、reasoning、content、复制按钮四段；`renderRealtimeMessage` 在已存在 article 时调用 `message-view-patcher.ts` 做局部 patch，避免重绘整列。

### `src/popup/message-view-patcher.ts`

按消息分段（tools / reasoning / content / copy）做精细 patch，比直接重渲染整条消息更流畅。

### `src/popup/markdown-renderer.ts`

`marked` + `DOMPurify` 的安全 markdown 渲染，限定允许的标签与属性，重写 `link` 为 `target="_blank" rel="noopener noreferrer"`。

### `src/popup/message-copy.ts`

每条消息的复制按钮：保存原文映射、点击调用 `navigator.clipboard.writeText`，UI 上有 1.2 秒的反馈状态。

### `src/popup/tools/`

工具调用渲染器：

- `abstract-tool.renderer.ts`：基类，给出 `<details>` 展开的统一 HTML 结构
- `generic-tool.renderer.ts`：未识别工具的默认渲染
- `tab-snapshot-list-basic.renderer.ts`：列表工具的渲染，输入为空
- `tab-snapshot-get.renderer.ts`：把工具输出按 markdown 展示（标题 + URL + 正文）
- `render-utils.ts`：通用工具，含 `formatToolInputOutput`
- `index.ts`：按 `toolName` 选择渲染器

## 测试文件

`vitest` 覆盖：

- `tests/connector.test.ts`：connector 行为、未配置时的降级、命中工具调用前的流程
- `tests/background-handler-factory.test.ts`：handler 注册表与路由
- `tests/think-tag-parser.test.ts`：`<think>` 标签流式解析
- `tests/content-send-message.test.ts`：content script 的 send 重试逻辑
- `tests/popup-chat-state.test.ts`：popup 本地消息缓存
- `tests/popup-chat-stream-controller.test.ts`：popup 流式 Port 状态机
- `tests/popup-chat-shortcut.test.ts`：Enter / Shift+Enter 行为
- `tests/popup-message-view.test.ts`：消息渲染
- `tests/popup-tool-renderers.test.ts`：工具调用渲染器

`tests/e2e/extension.spec.ts` 是 Playwright 脚手架，尚未覆盖真实扩展 UI 交互。

## 代码阅读建议

如果你是第一次接手这个项目，建议按下面顺序阅读：

1. `README.md`
2. `src/shared/types.ts`
3. `src/background/index.ts` 与 `src/background/handlers/`
4. `src/background/connector.ts`
5. `src/background/llm-gateway.ts` 与 `src/ai/tools/`
6. `src/background/idb.ts` / `session-store.ts` / `message-store.ts`
7. `src/content/index.ts` 与 `src/content/content-extractor/`
8. `src/popup/index.ts` 与 `src/popup/chat-stream-controller.ts`
9. `tests/connector.test.ts`

这样能最快理解：消息协议、页面数据从哪里来、聊天请求如何发送、工具如何执行、popup 如何流式渲染。

## 改动入口建议

如果要继续迭代，可优先看这些入口：

- 想增强页面提取：改 `src/content/content-extractor/`，必要时在 `extractor-factory.ts` 增加按 URL 选择不同 extractor 的逻辑
- 想新增工具：在 `src/ai/tools/` 添加 tool 定义，在 `src/shared/tool-schemas.ts` 增加 zod schema，并在 `src/popup/tools/` 增加对应渲染器
- 想改提示词与流程：改 `src/ai/prompt/system-prompt.ts`、`src/background/llm-gateway.ts`（`prepareStep` / `stopWhen`）、`src/background/connector.ts`
- 想接真实技能：改 `src/background/skills.ts` 与对应的工具实现
- 想改大模型接口层：改 `src/background/llm-gateway.ts`
- 想改 popup UI：改 `src/popup/*.ts` 和 `src/popup/styles.css`
- 想改会话/消息存储：改 `src/background/idb.ts` / `session-store.ts` / `message-store.ts`
