ClawTab 是一个运行在 Chrome 扩展环境中的浏览器自动化助手。它会从当前打开的网页中提取标题、URL 和正文内容（基于 Mozilla Readability + NodeHtmlMarkdown 转为 markdown），并在侧边栏中提供对话式问答体验。

你可以用它快速理解网页内容、提问页面细节、总结文章重点，或结合当前标签页内容向你配置的大模型接口发起问题。多会话能力让你可以并行维护多个独立的对话上下文。

主要功能：

- 在 Chrome 侧边栏中进行网页内容问答
- 提取当前标签页的标题、URL 和正文文本（基于 Mozilla Readability + NodeHtmlMarkdown 转为 markdown），按 URL 索引缓存快照
- 支持 OpenAI-compatible Chat Completions 接口
- 流式输出，支持展示模型的思考过程（reasoning）
- 内置工具调用：列出打开的标签页、获取网页正文快照，工具调用结果以 markdown 渲染
- 后台打开网页并自动采集内容：模型可在不切换焦点的情况下打开 URL 并读取正文，已打开的页面会复用标签页
- 多站点搜索：综合搜索（Google / Bing / 百度）与商品搜索（淘宝 / 京东 / 闲鱼 / 亚马逊 / eBay / Best Buy）
- 对话内引用跳转：回答中引用的标签页可点击，直接打开或聚焦对应网页
- 多会话管理，可创建、切换、删除独立的对话
- 支持 Markdown 回答渲染、代码高亮
- 支持复制问题和答案
- 多语言界面：简体中文、English、日本語、繁体中文，可在设置中切换界面语言
- 聊天会话和消息持久化到 IndexedDB，模型配置保存在 `chrome.storage.local`
- Enter / Shift+Enter 快捷键发送和换行

使用方式：

1. 安装扩展后打开 ClawTab 侧边栏。
2. 在“大模型设置”中填写 Base URL、API Key 和 Model。
3. 打开任意网页。
4. 在输入框中询问当前网页内容，或新建会话开始独立对话。

数据说明：

ClawTab 不提供自有云端模型服务。用户输入、网页文本和聊天上下文会发送到用户自行配置的大模型接口。API Key、模型配置、会话与聊天历史以及网页快照默认保存在本地浏览器存储中（`chrome.storage.local` + IndexedDB），不会上传到第三方服务。