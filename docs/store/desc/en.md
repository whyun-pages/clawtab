ClawTab is a browser automation assistant that runs inside the Chrome extension environment. It extracts the title, URL, and main content from the currently open web page (converted to markdown via Mozilla Readability + NodeHtmlMarkdown) and provides a conversational Q&A experience in the side panel.

You can use it to quickly understand web page content, ask about page details, summarize the key points of an article, or ask questions to your configured large language model interface based on the current tab's content. Multi-session support lets you maintain several independent conversation contexts in parallel.

Key features:

- Web content Q&A in the Chrome side panel
- Extracts the title, URL, and body text of the current tab (converted to markdown via Mozilla Readability + NodeHtmlMarkdown), caching snapshots indexed by URL
- Supports the OpenAI-compatible Chat Completions API
- Streaming output with support for displaying the model's reasoning process
- Built-in tool calls: list open tabs and fetch page body snapshots, with tool call results rendered as markdown
- Open pages in the background and auto-capture content: the model can open a URL without switching focus and read its body; an already-open page is reused
- Multi-site search: general search (Google / Bing / Baidu) and product search (Taobao / JD / Goofish / Amazon / eBay / Best Buy)
- In-chat citations: tabs referenced in an answer are clickable and open or focus the target page directly
- Multi-session management: create, switch, and delete independent conversations
- Markdown answer rendering and code highlighting
- Copy questions and answers
- Multilingual UI: Simplified Chinese, English, Japanese, and Traditional Chinese, switchable in settings
- Chat sessions and messages persisted to IndexedDB; model configuration saved in `chrome.storage.local`
- Enter / Shift+Enter shortcuts to send and add a line break

How to use:

1. Open the ClawTab side panel after installing the extension.
2. Fill in the Base URL, API Key, and Model in "LLM Settings".
3. Open any web page.
4. Ask about the current page content in the input box, or create a new session to start an independent conversation.

Data notice:

ClawTab does not provide its own cloud model service. User input, web page text, and chat context are sent to the large language model interface configured by the user. The API Key, model configuration, sessions and chat history, and web page snapshots are stored in local browser storage by default (`chrome.storage.local` + IndexedDB) and are not uploaded to any third-party service.
