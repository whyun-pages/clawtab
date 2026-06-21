# ClawTab 代码参考

## 目录结构

```text
clawtab/
├─ public/
│  ├─ manifest.json
│  └─ popup.html
├─ scripts/
│  └─ build.mjs
├─ src/
│  ├─ background/
│  │  ├─ connector.ts
│  │  ├─ index.ts
│  │  ├─ llm-gateway.ts
│  │  ├─ skills.ts
│  │  ├─ storage.ts
│  │  └─ tabContentStore.ts
│  ├─ content/
│  │  └─ index.ts
│  ├─ popup/
│  │  ├─ index.ts
│  │  └─ styles.css
│  └─ shared/
│     └─ types.ts
├─ tests/
│  ├─ e2e/
│  └─ connector.test.ts
├─ docs/
│  ├─ architecture.md
│  ├─ background-message-protocol.md
│  └─ code-reference.md
└─ README.md
```

## 文件职责

### `public/manifest.json`

Chrome 扩展声明文件。

负责定义：

- 扩展名称、版本、描述
- 权限：`storage`、`tabs`、`sidePanel`
- `background service worker`
- 默认 `popup`
- `content script` 注入规则

### `public/popup.html`

popup 的静态 HTML 壳。

包含：

- 标题区域
- 大模型配置表单
- 聊天消息容器
- 聊天输入区

### `scripts/build.mjs`

项目构建入口。

负责：

- 清理 `dist/`
- 复制静态资源
- 使用 `esbuild` 打包 `background`、`content`、`popup`
- 支持 `--watch`

### `src/shared/types.ts`

项目的共享类型中心。

主要定义：

- 页面快照：`PageSnapshot`
- 聊天消息：`ChatMessage`
- 大模型配置：`LlmConfig`
- connector 结果：`ConnectorResult`
- runtime message 协议

这是 `content`、`popup`、`background` 间的协议基础。

## Background 模块

### `src/background/index.ts`

后台入口，负责消息路由。

它处理的消息类型包括：

- `content/snapshot`
- `chat/send`
- `chat/state:get`
- `chat/state:reset`
- `config/get`
- `config/save`

这里是“扩展内部 API 层”。

协议细节可参考：`docs/background-message-protocol.md`

### `src/background/tabContentStore.ts`

内存中的标签页快照缓存。

对外暴露：

- `upsertSnapshot()`
- `removeSnapshot()`
- `listSnapshots()`

适合保存轻量级、临时页面上下文。

### `src/background/storage.ts`

基于 `chrome.storage.local` 的持久化模块。

对外暴露：

- `getConfig()`
- `saveConfig()`
- `getHistory()`
- `saveHistory()`
- `resetHistory()`

特点：

- 对配置做了默认值和归一化处理
- 对 Base URL、API Key 和模型名做默认值与归一化处理

### `src/background/skills.ts`

技能判定模块。

当前主要提供：

- `decideSkill()`：根据关键词判断技能类型
- `runSkill()`：占位用的技能执行函数

注意：

- 当前主链路实际使用的是 `decideSkill()`
- `runSkill()` 目前还未接入真实调用

### `src/background/llm-gateway.ts`

OpenAI-compatible 大模型接口的 HTTP 封装。

核心职责：

- 调用 `/v1/chat/completions`
- 设置认证头
- 将统一的 `ChatMessage[]` 映射为 OpenAI 兼容请求格式
- 解析返回文本
- 抛出明确错误

### `src/background/connector.ts`

connector 核心逻辑。

主要流程：

1. 从所有标签页中筛选相关 tab
2. 根据用户问题做 skill 判定
3. 生成 system prompt
4. 将最近一段聊天历史和当前问题拼成请求
5. 调用大模型接口

里面几个关键函数：

- `scoreTab()`：计算标签页相关性分数
- `selectRelatedTabs()`：选出前 3 个最相关标签页
- `summarizeTabs()`：把标签页摘要格式化成 prompt 片段
- `buildSystemPrompt()`：生成 system prompt
- `runConnector()`：主入口

## Content 模块

### `src/content/index.ts`

负责从页面提取文本并上报。

关键逻辑：

- `extractText()`：读取正文并裁剪长度
- `sendSnapshot()`：将页面快照发给后台

这里不保存状态，只负责“采集”。

## Popup 模块

### `src/popup/index.ts`

popup 交互主逻辑。

主要职责：

- 初始化聊天历史和配置
- 发送聊天请求
- 保存大模型配置
- 清空聊天历史
- 渲染消息列表

关键函数：

- `bootstrap()`：首次加载状态
- `pushMessage()`：本地追加消息
- `render()`：更新消息列表 DOM
- `hydrateConfig()`：将配置写回表单
- `buildConfigStatus()`：生成当前配置状态文案
- `escapeHtml()`：输出转义

### `src/popup/styles.css`

popup 的样式文件。

当前覆盖：

- 页头
- 配置面板
- 聊天气泡
- 输入区和按钮

## 测试文件

### `tests/connector.test.ts`

当前最核心的单元测试文件。

覆盖重点：

- skill 判定
- 缺失配置时的降级逻辑
- Gateway 调用是否命中正确 URL 与请求头

### `tests/e2e/extension.spec.ts`

Playwright 端到端测试脚手架。

当前仍是占位状态，尚未覆盖真实扩展 UI 交互。

## 代码阅读建议

如果你是第一次接手这个项目，建议按下面顺序阅读：

1. `README.md`
2. `src/shared/types.ts`
3. `src/background/index.ts`
4. `src/background/connector.ts`
5. `src/background/llm-gateway.ts`
6. `src/content/index.ts`
7. `src/popup/index.ts`
8. `tests/connector.test.ts`

这样能最快理解：

- 消息协议
- 页面数据从哪里来
- 聊天请求如何发送
- 大模型接口是怎么接入的

## 改动入口建议

如果要继续迭代，可优先看这些入口：

- 想增强页面提取：改 `src/content/index.ts`
- 想增强提示词和路由：改 `src/background/connector.ts`
- 想接真实技能：改 `src/background/skills.ts`
- 想改大模型接口层：改 `src/background/llm-gateway.ts`
- 想改 UI：改 `src/popup/index.ts` 和 `src/popup/styles.css`
