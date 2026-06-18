/* eslint-disable @typescript-eslint/no-misused-promises */
import '../lib/sentry-setup';

import './styles.css';

import type {
  ChatMessage,
  GetChatStateRequest,
  GetChatStateResponse,
  LlmConfig,
  ResetChatStateRequest,
  SaveConfigRequest,
  SaveConfigResponse,
  SendChatRequest,
  SendChatResponse,
} from '../shared/types';

const messagesElement = document.querySelector<HTMLElement>('#messages');
const formElement = document.querySelector<HTMLFormElement>('#chat-form');
const inputElement = document.querySelector<HTMLTextAreaElement>('#chat-input');
const submitButton =
  document.querySelector<HTMLButtonElement>('#submit-button');
const resetButton = document.querySelector<HTMLButtonElement>('#reset-button');
const configForm = document.querySelector<HTMLFormElement>('#config-form');
const baseUrlInput =
  document.querySelector<HTMLInputElement>('#config-base-url');
const apiKeyInput = document.querySelector<HTMLInputElement>('#config-api-key');
const modelInput = document.querySelector<HTMLInputElement>('#config-model');
const configStatus = document.querySelector<HTMLElement>('#config-status');

let history: ChatMessage[] = [];
let currentConfig: LlmConfig | null = null;

void bootstrap();

formElement?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const message = inputElement?.value.trim();
  if (!message || !inputElement || !submitButton) {
    return;
  }

  inputElement.value = '';
  submitButton.disabled = true;

  try {
    const request: SendChatRequest = {
      type: 'chat/send',
      message,
    };
    const response: SendChatResponse =
      await chrome.runtime.sendMessage(request);
    history = response.history;
    render();
  } catch (error) {
    pushMessage('assistant', `请求失败：${String(error)}`);
  } finally {
    submitButton.disabled = false;
  }
});

resetButton?.addEventListener('click', async () => {
  const request: ResetChatStateRequest = {
    type: 'chat/state:reset',
  };
  const response: GetChatStateResponse =
    await chrome.runtime.sendMessage(request);
  history = response.history;
  currentConfig = response.config;
  hydrateConfig(currentConfig);
  setConfigStatus(buildConfigStatus(currentConfig));
  render();
});

configForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const nextConfig: LlmConfig = {
    baseUrl: baseUrlInput?.value.trim() || '',
    apiKey: apiKeyInput?.value.trim() || '',
    model: modelInput?.value.trim() || '',
  };
  const request: SaveConfigRequest = {
    type: 'config/save',
    config: nextConfig,
  };
  const response: SaveConfigResponse =
    await chrome.runtime.sendMessage(request);
  currentConfig = response.config;
  hydrateConfig(currentConfig);
  setConfigStatus(buildConfigStatus(currentConfig));
});

function pushMessage(role: ChatMessage['role'], content: string): void {
  history.push({
    id: crypto.randomUUID(),
    role,
    content,
  });
  render();
}

async function bootstrap(): Promise<void> {
  const request: GetChatStateRequest = {
    type: 'chat/state:get',
  };
  const response: GetChatStateResponse =
    await chrome.runtime.sendMessage(request);
  history = response.history;
  currentConfig = response.config;
  hydrateConfig(response.config);
  setConfigStatus(buildConfigStatus(response.config));
  render();
}

function render(): void {
  if (!messagesElement) {
    return;
  }

  messagesElement.innerHTML = history
    .map(
      (message) =>
        `<article class="message message--${message.role === 'user' ? 'user' : 'assistant'}">${escapeHtml(
          message.content,
        )}</article>`,
    )
    .join('');

  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function hydrateConfig(config: LlmConfig): void {
  if (baseUrlInput) {
    baseUrlInput.value = config.baseUrl;
  }
  if (apiKeyInput) {
    apiKeyInput.value = config.apiKey;
  }
  if (modelInput) {
    modelInput.value = config.model;
  }
}

function setConfigStatus(value: string): void {
  if (configStatus) {
    configStatus.textContent = value;
  }
}

function buildConfigStatus(config: LlmConfig): string {
  if (!config.apiKey) {
    return '未配置 API Key，发送消息时不会调用真实大模型接口。';
  }

  return `已配置 ${config.baseUrl}，模型 ${config.model}。`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
