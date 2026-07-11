# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-07-11

### Added

- **Internationalization**: `chrome.i18n`-based i18n layer shipping four locales — `zh_CN` (default), `en`, `ja`, `zh_TW`. A runtime wrapper lets users override the browser UI language from the extension; session default titles and the assistant welcome message are stored with translation keys so they re-localize when the locale changes.
- **Redesigned settings panel**: left-nav + right-content layout with two sections — **LLM** (existing Base URL / API Key / Model form) and **Display** (new language selector). The active section is persisted across popup reopens.
- **Multi-site product search**: dedicated search URL builders and extractors for Taobao, JD, Goofish, Amazon, eBay, and Best Buy, split into product / search variants per site.
- **In-chat citations**: assistant messages that reference tabs now render clickable citations with a dedicated popup view and styling; a new `tab/activate` message lets citations open or focus the target tab.
- **`pageOpen` tool**: model can request opening a URL in a background tab, driven by a new tool exposed via the AI SDK gateway.
- **`search` tool**: model can trigger multi-site product searches via a first-class tool call.
- **Bilingual marketing site**: the `site/` landing page ships English and Chinese versions plus a privacy policy document.

### Changed

- System prompt now instructs the model to open unknown URLs via `tabOpenInBackground` before answering, so it hydrates a page snapshot instead of guessing.

### Removed

- **Non-streaming chat path**: `requestLlm`, `runConnector`, `sendChatHandler`, and the `chat/send` runtime message are deleted along with their tests and docs. The popup has been streaming-only in production for a while, and `llm-gateway.ts` now only ships `streamLlm` (no more `generateText` in the background bundle).

[0.2.0]: https://github.com/whyun-pages/clawtab/compare/v0.1.0...v0.2.0
