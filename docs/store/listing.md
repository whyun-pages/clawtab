# Chrome Web Store Listing

## Extension name

ClawTab

## Short description

在 Chrome 侧边栏中基于当前网页内容进行 AI 问答，支持多会话与工具调用。

## Detailed description

ClawTab 是一个运行在 Chrome 扩展环境中的浏览器自动化助手。它会从当前打开的网页中提取标题、URL 和正文内容（基于 Mozilla Readability + NodeHtmlMarkdown 转为 markdown），并在侧边栏中提供对话式问答体验。

你可以用它快速理解网页内容、提问页面细节、总结文章重点，或结合当前标签页内容向你配置的大模型接口发起问题。多会话能力让你可以并行维护多个独立的对话上下文。

主要功能：

- 在 Chrome 侧边栏中进行网页内容问答
- 提取当前标签页的标题、URL 和正文文本，按 URL 索引缓存快照
- 支持 OpenAI-compatible Chat Completions 接口
- 流式输出，支持展示模型的思考过程（reasoning）
- 内置工具调用：可读取标签页列表与网页正文，工具调用结果以 Markdown 渲染
- 多会话管理，可创建、切换、删除独立的对话
- 支持 Markdown 回答渲染、代码高亮
- 支持复制问题和答案
- 聊天会话和消息持久化到 IndexedDB，模型配置保存在 `chrome.storage.local`
- Enter / Shift+Enter 快捷键发送和换行

使用方式：

1. 安装扩展后打开 ClawTab 侧边栏。
2. 在“大模型设置”中填写 Base URL、API Key 和 Model。
3. 打开任意网页。
4. 在输入框中询问当前网页内容，或新建会话开始独立对话。

数据说明：

ClawTab 不提供自有云端模型服务。用户输入、网页文本和聊天上下文会发送到用户自行配置的大模型接口。API Key、模型配置、会话与聊天历史以及网页快照默认保存在本地浏览器存储中（`chrome.storage.local` + IndexedDB），不会上传到第三方服务。错误信息可选地通过 Sentry 上报，用于稳定性诊断。

## Category

Productivity

## Language

Chinese (Simplified)

## Suggested screenshots

Chrome Web Store 至少需要 1 张截图。建议准备以下截图：

- 侧边栏打开后的聊天主界面
- 大模型设置表单
- 对网页内容提问并显示 Markdown 回答
- 多会话切换列表
- 工具调用区域（标签页列表 / 网页快照）和复制按钮效果
- 流式输出与思考过程展开

推荐截图尺寸：

- 1280 x 800
- 或 640 x 400

## Suggested promotional images

可选，但建议后续准备：

- Small promo tile: 440 x 280
- Marquee promo tile: 1400 x 560

