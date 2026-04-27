# ClawTab 架构文档

## 项目定位

ClawTab 是一个运行在 Chrome 插件环境中的浏览器自动化助手原型。它的核心目标是：

- 从当前浏览器标签页提取页面上下文
- 在插件弹窗中与用户对话
- 将页面摘要、聊天历史和技能判定一起发送给 OpenClaw Gateway
- 由 OpenClaw 返回最终回答

当前项目以 Chrome Extension Manifest V3 为基础，代码使用 TypeScript + ESM 编写。

## 整体架构

项目由三个主要运行入口组成：

- `content script`
- `background service worker`
- `popup`

它们的职责分工如下：

### 1. `content script`

位置：`src/content/index.ts`

职责：

- 读取当前页面的 `title`
- 读取当前页面的 `url`
- 提取页面正文文本
- 将提取结果通过 `chrome.runtime.sendMessage()` 发给后台

当前提取策略比较轻量：

- 使用 `document.body?.innerText`
- 去掉多余空白
- 最多保留 4000 个字符

触发时机：

- 页面 `load`
- 页面重新变为可见时

### 2. `background service worker`

位置：`src/background/index.ts`

职责：

- 接收 `content script` 发来的页面快照
- 用 `sender.tab?.id` 给快照补全真实 `tabId`
- 维护当前标签页快照缓存
- 处理 popup 发来的聊天、配置和状态请求
- 调用 connector 拼装上下文并访问 OpenClaw Gateway
- 将聊天历史与配置存入 `chrome.storage.local`

这是整个扩展的中枢。

### 3. `popup`

位置：`src/popup/index.ts`

职责：

- 展示聊天消息列表
- 提交用户问题
- 展示和保存 OpenClaw Gateway 配置
- 清空当前对话历史
- 从后台读取初始化状态并渲染 UI

`popup` 不直接调用 OpenClaw，而是统一走 `background`。

## 核心数据流

### 页面快照链路

1. 用户打开网页
2. `content script` 提取页面文本
3. 发送 `content/snapshot` 消息到 `background`
4. `background` 补齐 `tabId`
5. 页面快照保存到内存中的 `Map<number, PageSnapshot>`

### 聊天链路

1. 用户在 `popup` 输入消息
2. `popup` 发送 `chat/send`
3. `background` 读取：
   - 当前 Gateway 配置
   - 已保存聊天历史
   - 当前标签页快照列表
4. `connector` 选择相关标签页
5. `connector` 判断是否命中 `shopping` / `social` / `video` skill
6. `connector` 构造 system prompt
7. `background` 调用 OpenClaw Gateway 的 `/v1/chat/completions`
8. OpenClaw 返回回答
9. `background` 更新聊天历史
10. `popup` 渲染最新历史

### 配置链路

1. 用户在 `popup` 填写 Base URL / Token / Model / Agent ID
2. `popup` 发送 `config/save`
3. `background` 调用 `storage.ts` 进行归一化和持久化
4. 后续聊天请求复用同一份配置

## Connector 设计

位置：`src/background/connector.ts`

connector 的职责不是直接做 UI 或存储，而是负责把“当前上下文”变成一次可发送给 OpenClaw 的请求。

它当前做了四件事：

1. 选取与用户问题最相关的标签页
2. 对问题进行 skill 判定
3. 根据标签页摘要和判定结果构造 system prompt
4. 在配置有效时调用真实 OpenClaw Gateway

如果配置不完整，connector 不会发请求，而是返回“请先配置 Gateway”的引导文案。

## Skill 判定机制

位置：`src/background/skills.ts`

当前 skill 判定是关键词匹配，规则包括：

- `shopping`：价格、多少钱、优惠、对比、商品、购买
- `social`：热点、热搜、新闻、趋势、时事
- `video`：视频、字幕、总结、讲了什么、片段

当前状态下：

- skill 判定结果会进入 prompt
- 真实的 skill 执行链路还没有接入
- `runSkill()` 仍然是占位实现，后续可扩展为真实站点自动化

## OpenClaw Gateway 接入方式

位置：`src/background/openclawGateway.ts`

当前通过 OpenClaw 的 OpenAI 兼容接口接入：

- 接口：`POST /v1/chat/completions`
- 默认 Base URL：`http://127.0.0.1:18789/v1`

请求中会带上：

- `Authorization: Bearer <token>`
- `x-openclaw-agent-id`
- `x-openclaw-session-key`

请求体中包含：

- `model`
- `stream: false`
- `messages`

这里的 `messages` 由 system prompt、历史消息和当前用户消息组成。

## 状态管理

项目当前有两种状态存储：

### 1. 内存态

位置：`src/background/tabContentStore.ts`

用途：

- 保存当前活跃标签页的页面快照
- 按更新时间倒序返回

特点：

- service worker 重启后会丢失
- 适合轻量运行期上下文

### 2. 持久态

位置：`src/background/storage.ts`

用途：

- 保存 OpenClaw Gateway 配置
- 保存聊天历史

存储介质：

- `chrome.storage.local`

## 构建方式

位置：`scripts/build.mjs`

构建工具是 `esbuild`，主要做这些事：

- 清空 `dist/`
- 复制 `public/` 到 `dist/`
- 复制 `src/popup/styles.css` 到 `dist/styles.css`
- 打包三个入口：
  - `src/background/index.ts`
  - `src/content/index.ts`
  - `src/popup/index.ts`

输出格式为 ESM，目标浏览器为 `chrome114`。

## 测试策略

当前测试以 `vitest` 为主，位置：`tests/connector.test.ts`

已覆盖的内容：

- skill 判定是否正确
- 未配置 Gateway 时是否返回引导文案
- 已配置 Gateway 时是否向正确接口发起请求

`playwright` 目前还是脚手架级别，尚未覆盖真实扩展交互。

## 当前限制

- 页面正文提取仍然比较粗糙，只取 `innerText`
- 标签页快照只存在内存中，没有持久化
- skill 仅完成判定，没有接入真实自动化执行
- 聊天请求是非流式返回
- popup UI 仍是原型级实现

## 推荐后续演进方向

- 将 `runSkill()` 接入真实浏览器自动化或 OpenClaw 工具调用
- 为标签页快照增加持久化和失效策略
- 支持流式输出和更好的错误提示
- 增加真实的扩展端到端测试
- 将 connector 的 prompt 组装策略进一步模块化
