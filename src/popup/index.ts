import '../lib/sentry-setup';

import './styles.css';

import type {
  GetChatStateRequest,
  GetChatStateResponse,
} from '../shared/types';
import { initI18n, LOCALE_CHANGED_EVENT } from '../shared/i18n';
import { applyI18nToDom } from '../shared/i18n-dom';
import { getConfig, getHistory, setConfig, setHistory } from './chat-state';
import { bindChatShortcut } from './chat-shortcut';
import { bindCitationActions } from './citation-view';
import { startChatStream, stopChatStream } from './chat-stream-controller';
import {
  buildConfigStatus,
  hydrateConfig,
  setConfigStatus,
} from './config-controller';
import { formElement, inputElement, submitButton } from './dom';
import { bindMessageCopyActions } from './message-copy';
import { renderMessages, renderRealtimeMessage } from './message-view';
import { mountSessionPanel, refreshSessionPanel } from './session-panel';
import { mountSettingsPanel } from './settings-panel';

void bootstrap();

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
  // i18n must resolve before any component renders, so that the initial paint
  // uses the correct locale and DOM attributes get translated in one pass.
  await initI18n();
  applyI18nToDom(document);

  bindMessageCopyActions();
  bindCitationActions();
  bindChatForm();
  bindShortcut();
  mountSettingsPanel({
    onConfigSaved: (config) => {
      setConfig(config);
    },
  });

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

  window.addEventListener(LOCALE_CHANGED_EVENT, () => {
    applyI18nToDom(document);
    // Chat state (config status, session labels, message list) is dynamically
    // rendered — recompute against the latest known config so translated
    // strings pick up the new locale.
    const config = getConfig();
    if (config) {
      setConfigStatus(buildConfigStatus(config));
    }
    refreshSessionPanel();
    render();
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
