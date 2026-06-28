# Chrome Web Store Review Notes

## Test account / test configuration

ClawTab requires an OpenAI-compatible Chat Completions endpoint. Before submitting, provide reviewers with one of the following:

- A temporary Base URL, API Key, and Model for testing.
- Or clear instructions that reviewers can use their own OpenAI-compatible endpoint.

Recommended test fields:

```text
Base URL: <provide test endpoint>
API Key: <provide temporary key>
Model: <provide model name>
```

## How to test

1. Install the extension.
2. Open any article or documentation page.
3. Open the ClawTab side panel or popup.
4. Expand “大模型设置”.
5. Enter Base URL, API Key, and Model.
6. Ask: “总结一下当前网页”.
7. Confirm the extension extracts the current page content and returns an answer.
8. Confirm Markdown answers render correctly.
9. Confirm the copy icon under user and assistant messages copies the original text.

## Permission justification

The following justifications are written to be pasted directly into the Chrome Web Store "Single purpose" / "Permissions" form. Each item explains *what* the permission is used for, *why* it is required, and *why a narrower alternative is not sufficient*.

### `storage`

- **Used for**: Persisting the user's model configuration (Base URL, API Key, Model name), local chat history, and per-tab page content snapshots via `chrome.storage.local`.
- **Why required**: The extension must remember the user's endpoint configuration between sessions so the user does not need to re-enter credentials on every browser restart. Chat history and page snapshots are stored locally so the side panel can restore context after the service worker is suspended.
- **Why a narrower API is not sufficient**: `chrome.storage.local` is the standard local-only storage API for MV3 extensions. No data is synced to any Google account or remote server.

### `tabs`

- **Used for**:
  - `chrome.tabs.query` — enumerating tabs in the current window so the user can pick which page(s) to chat about.
  - `chrome.tabs.onUpdated` / `chrome.tabs.onRemoved` — keeping the per-tab content snapshot store in sync (refresh on navigation, clean up when a tab is closed).
  - `chrome.tabs.sendMessage` — communicating with the content script in the active tab to fetch the latest extracted text.
- **Why required**: ClawTab's core value is answering questions grounded in the user's currently open pages; this requires knowing which tabs exist and the ability to message their content scripts.
- **Why a narrower API is not sufficient**: `activeTab` alone does not allow the extension to enumerate or track multiple tabs across the session, which is needed for the multi-session feature.

### `sidePanel`

- **Used for**: Registering and opening the chat UI inside Chrome's side panel (`chrome.sidePanel`).
- **Why required**: The primary user interface is a side panel so the user can read the page and chat with the model side-by-side. Without this permission the panel cannot be registered.

### `host_permissions: <all_urls>` and content script matching `<all_urls>`

- **Used for**: Injecting a content script that extracts the visible text of the current webpage so the model can answer based on its actual content.
- **Why required**: The user can ask ClawTab to summarize or answer questions about *any* page they choose to open. The set of target sites is not knowable in advance, so the extension cannot ship a fixed match list.
- **Scope of access**: The content script only reads page text on demand when the user opens the side panel or sends a message. It does not run background scraping, does not collect form data, credentials, or cookies, and does not exfiltrate any data except as part of the user-initiated request to the user-configured model endpoint.

### Remote code

ClawTab does **not** load or execute any remote code. All JavaScript is bundled into the extension package. The only outbound network traffic is the user's question plus relevant page text sent to the **user-configured** OpenAI-compatible Chat Completions endpoint. ClawTab does not operate its own backend.

## Privacy disclosure summary

The extension processes page text, user questions, chat history, and model configuration. User questions and relevant page content are sent to the user-configured model endpoint. ClawTab does not operate its own backend service.

