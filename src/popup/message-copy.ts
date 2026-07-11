import type { ChatMessage } from '../shared/types';
import { t } from '../shared/i18n';
import { messagesElement } from './dom';
import { escapeHtml } from './tools/render-utils';

const copyTextByMessageId = new Map<string, string>();
const copyFeedbackTimers = new WeakMap<
  HTMLButtonElement,
  ReturnType<typeof setTimeout>
>();
const copyIconHtml =
  '<svg class="message__copy-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="10" height="10" rx="2"></rect><path d="M5 15V7a2 2 0 0 1 2-2h8"></path></svg>';
const copiedIconHtml =
  '<svg class="message__copy-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-8"></path></svg>';

export function clearMessageCopyTexts(): void {
  copyTextByMessageId.clear();
}

export function renderMessageCopyButton(message: ChatMessage): string {
  if (
    (message.role !== 'assistant' && message.role !== 'user') ||
    !message.content.trim()
  ) {
    copyTextByMessageId.delete(message.cid);
    return '';
  }

  copyTextByMessageId.set(message.cid, message.content);

  const copyLabel = t('message_copy');
  return `<div class="message__actions"><button class="message__copy" type="button" aria-label="${escapeHtml(
    copyLabel,
  )}" title="${escapeHtml(copyLabel)}" data-copy-message-id="${escapeHtml(
    message.cid,
  )}">${copyIconHtml}</button></div>`;
}

export function bindMessageCopyActions(): void {
  messagesElement?.addEventListener('click', (event) => {
    const target = event.target;
    if (!isElementLike(target)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>('[data-copy-message-id]');
    if (!button) {
      return;
    }

    void copyMessageText(button);
  });
}

function isElementLike(
  target: EventTarget | null,
): target is Element & { closest: Element['closest'] } {
  return (
    typeof target === 'object' &&
    target !== null &&
    'closest' in target &&
    typeof target.closest === 'function'
  );
}

async function copyMessageText(button: HTMLButtonElement): Promise<void> {
  const messageId = button.dataset.copyMessageId;
  if (!messageId) {
    return;
  }

  const text = copyTextByMessageId.get(messageId);
  if (text === undefined) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showCopyFeedback(button, true);
  } catch {
    showCopyFeedback(button, false);
  }
}

function showCopyFeedback(button: HTMLButtonElement, isSuccess: boolean): void {
  const existingTimer = copyFeedbackTimers.get(button);
  if (existingTimer !== undefined) {
    clearTimeout(existingTimer);
  }

  const label = t(isSuccess ? 'message_copied' : 'message_copy_failed');
  button.innerHTML = isSuccess ? copiedIconHtml : copyIconHtml;
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.dataset.copyState = isSuccess ? 'success' : 'error';
  const timer = setTimeout(() => {
    const idleLabel = t('message_copy');
    button.innerHTML = copyIconHtml;
    button.setAttribute('aria-label', idleLabel);
    button.setAttribute('title', idleLabel);
    delete button.dataset.copyState;
    copyFeedbackTimers.delete(button);
  }, 1200);
  copyFeedbackTimers.set(button, timer);
}
