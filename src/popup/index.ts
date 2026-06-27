import '../lib/sentry-setup';

import './styles.css';

import type {
  GetChatStateRequest,
  GetChatStateResponse,
} from '../shared/types';
import { getHistory, setConfig, setHistory } from './chat-state';
import { bindChatShortcut } from './chat-shortcut';
import { startChatStream, stopChatStream } from './chat-stream-controller';
import { buildConfigStatus, hydrateConfig, setConfigStatus } from './config-controller';
import { formElement, inputElement, submitButton } from './dom';
import { bindMessageCopyActions } from './message-copy';
import { renderMessages, renderRealtimeMessage } from './message-view';
import { mountSessionPanel } from './session-panel';
import { mountSettingsPanel } from './settings-panel';

void bootstrap();
bindMessageCopyActions();
bindChatForm();
bindShortcut();
mountSettingsPanel({
  onConfigSaved: (config) => {
    setConfig(config);
  },
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
      setHistory,
      renderHistory: render,
      renderRealtimeMessage,
      setSubmitting,
    });
  });
}

function bindShortcut(): void {
  if (!inputElement || !formElement || !submitButton) {
    return;
  }
  bindChatShortcut({
    input: inputElement,
    form: formElement,
    submitter: submitButton,
  });
}

async function bootstrap(): Promise<void> {
  const response = await fetchChatState();

  setHistory(response.history);
  setConfig(response.config);
  hydrateConfig(response.config);
  setConfigStatus(buildConfigStatus(response.config));
  render();

  mountSessionPanel({
    initialSessions: response.sessions,
    initialCurrentSid: response.currentSid,
    onSessionChanged: refreshChatState,
  });
}

async function refreshChatState(): Promise<void> {
  stopChatStream();
  const response = await fetchChatState();
  setHistory(response.history);
  setConfig(response.config);
  hydrateConfig(response.config);
  setConfigStatus(buildConfigStatus(response.config));
  render();
}

async function fetchChatState(): Promise<GetChatStateResponse> {
  const request: GetChatStateRequest = { type: 'chat/state:get' };
  return chrome.runtime.sendMessage(request);
}

function render(): void {
  renderMessages(getHistory());
}

function setSubmitting(isSubmitting: boolean): void {
  if (submitButton) {
    submitButton.disabled = isSubmitting;
  }
}
