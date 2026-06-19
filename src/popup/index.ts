import '../lib/sentry-setup';

import './styles.css';

import type {
  GetChatStateRequest,
  GetChatStateResponse,
  ResetChatStateRequest,
} from '../shared/types';
import {
  appendMessage,
  appendMessageToolCall,
  getHistory,
  replaceMessageId,
  setConfig,
  setHistory,
  updateMessage,
  updateMessageReasoning,
} from './chat-state';
import { startChatStream, stopChatStream } from './chat-stream-controller';
import {
  bindConfigForm,
  buildConfigStatus,
  hydrateConfig,
  setConfigStatus,
} from './config-controller';
import { formElement, inputElement, resetButton, submitButton } from './dom';
import { renderMessages } from './message-view';

void bootstrap();
bindChatForm();
bindResetButton();
bindConfigForm((config) => {
  setConfig(config);
});

function bindChatForm(): void {
  formElement?.addEventListener('submit', (event) => {
    event.preventDefault();

    const message = inputElement?.value.trim();
    if (!message || !inputElement || !submitButton) {
      return;
    }

    inputElement.value = '';
    startChatStream(message, {
      appendMessage,
      appendMessageToolCall,
      replaceMessageId,
      setHistory,
      updateMessage,
      updateMessageReasoning,
      render,
      setSubmitting,
    });
  });
}

function bindResetButton(): void {
  resetButton?.addEventListener('click', () => {
    void resetChatState();
  });
}

async function bootstrap(): Promise<void> {
  const request: GetChatStateRequest = {
    type: 'chat/state:get',
  };
  const response: GetChatStateResponse =
    await chrome.runtime.sendMessage(request);

  setHistory(response.history);
  setConfig(response.config);
  hydrateConfig(response.config);
  setConfigStatus(buildConfigStatus(response.config));
  render();
}

async function resetChatState(): Promise<void> {
  stopChatStream();

  const request: ResetChatStateRequest = {
    type: 'chat/state:reset',
  };
  const response: GetChatStateResponse =
    await chrome.runtime.sendMessage(request);

  setHistory(response.history);
  setConfig(response.config);
  hydrateConfig(response.config);
  setConfigStatus(buildConfigStatus(response.config));
  render();
}

function render(): void {
  renderMessages(getHistory());
}

function setSubmitting(isSubmitting: boolean): void {
  if (submitButton) {
    submitButton.disabled = isSubmitting;
  }
}
