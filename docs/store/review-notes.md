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

- `storage`: stores local chat history and model configuration.
- `tabs`: associates extracted page snapshots with browser tabs.
- `sidePanel`: provides the side panel chat interface.
- `<all_urls>` host permission: allows the content script to extract page text from user-opened webpages so answers can be based on actual page content.

## Privacy disclosure summary

The extension processes page text, user questions, chat history, and model configuration. User questions and relevant page content are sent to the user-configured model endpoint. ClawTab does not operate its own backend service.

