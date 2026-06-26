import type { ChatMessage } from '../shared/types';
import { renderMarkdown } from './markdown-renderer';
import { renderMessageCopyButton } from './message-copy';
import {
  renderContentSection,
  renderReasoningSection,
  renderToolCallItems,
  renderToolCallsSection,
} from './message-view';
import { escapeHtml } from './tools/render-utils';

export function patchMessageSections(
  article: HTMLElement,
  message: ChatMessage,
): void {
  updateToolCallsSection(article, message);
  updateReasoningSection(article, message);
  updateContentSection(article, message);
  updateCopyButton(article, message);
}

function updateToolCallsSection(
  article: HTMLElement,
  message: ChatMessage,
): void {
  const shouldShow =
    message.role === 'assistant' && !!message.toolCalls?.length;
  const existing = article.querySelector<HTMLElement>(
    ':scope > .message__tools',
  );

  if (shouldShow && existing) {
    existing.innerHTML = renderToolCallItems(message.toolCalls!);
    return;
  }

  if (shouldShow && !existing) {
    article.insertAdjacentHTML(
      'afterbegin',
      renderToolCallsSection(message.toolCalls!),
    );
    return;
  }

  if (!shouldShow && existing) {
    existing.remove();
  }
}

function updateReasoningSection(
  article: HTMLElement,
  message: ChatMessage,
): void {
  const shouldShow =
    message.role === 'assistant' && !!message.reasoning?.trim();
  const existing = article.querySelector<HTMLElement>(
    ':scope > .message__reasoning',
  );

  if (shouldShow && existing) {
    const inner = existing.querySelector<HTMLElement>(':scope > div');
    if (inner) {
      inner.innerHTML = escapeHtml(message.reasoning!);
    } else {
      existing.outerHTML = renderReasoningSection(message.reasoning!);
    }
    return;
  }

  if (shouldShow && !existing) {
    const html = renderReasoningSection(message.reasoning!);
    const tools = article.querySelector<HTMLElement>(
      ':scope > .message__tools',
    );
    if (tools) {
      tools.insertAdjacentHTML('afterend', html);
    } else {
      article.insertAdjacentHTML('afterbegin', html);
    }
    return;
  }

  if (!shouldShow && existing) {
    existing.remove();
  }
}

function updateContentSection(
  article: HTMLElement,
  message: ChatMessage,
): void {
  if (message.role === 'assistant') {
    const existing = article.querySelector<HTMLElement>(
      ':scope > .message__markdown',
    );
    if (existing) {
      existing.innerHTML = renderMarkdown(message.content);
      return;
    }
    insertContentSection(article, message);
    return;
  }

  const existing = article.querySelector<HTMLElement>(
    ':scope > .message__plain',
  );
  if (existing) {
    existing.textContent = message.content;
    return;
  }
  insertContentSection(article, message);
}

function insertContentSection(
  article: HTMLElement,
  message: ChatMessage,
): void {
  const html = renderContentSection(message);
  const copy = article.querySelector<HTMLElement>(':scope > .message__actions');
  if (copy) {
    copy.insertAdjacentHTML('beforebegin', html);
  } else {
    article.insertAdjacentHTML('beforeend', html);
  }
}

function updateCopyButton(article: HTMLElement, message: ChatMessage): void {
  const html = renderMessageCopyButton(message);
  const existing = article.querySelector<HTMLElement>(
    ':scope > .message__actions',
  );

  if (!html) {
    if (existing) {
      existing.remove();
    }
    return;
  }

  if (existing) {
    return;
  }

  article.insertAdjacentHTML('beforeend', html);
}
