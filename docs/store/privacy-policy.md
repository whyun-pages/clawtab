# ClawTab Privacy Policy

Effective date: 2026-06-21

ClawTab is a Chrome extension that helps users ask questions about the content of their current browser tabs.

## Data processed by the extension

ClawTab may process the following data to provide its core features:

- Web page content: page title, URL, and extracted article or page text.
- User input: questions typed into the ClawTab chat box.
- Chat history: previous user and assistant messages.
- Extension settings: model Base URL, API Key, and model name.

## How data is used

ClawTab uses page content and user questions to generate answers through the OpenAI-compatible chat completion endpoint configured by the user.

The extension stores chat history and model configuration in Chrome local storage so the side panel can restore previous state.

## Data sharing

ClawTab does not operate its own backend service.

When the user sends a question, the extension sends the relevant page content, user question, and conversation context to the model endpoint configured by the user. The privacy and retention practices of that endpoint are controlled by the endpoint provider chosen by the user.

## API keys

The API Key entered by the user is stored locally in Chrome storage and is used only to call the configured model endpoint.

## Remote code

ClawTab does not intentionally load remote executable code. The extension package includes its own JavaScript bundle.

## User control

Users can clear chat history from the extension UI. Users can also remove extension data through Chrome extension storage controls or by uninstalling the extension.

## Contact

For privacy questions, provide your support email or support URL before publishing this policy publicly.

