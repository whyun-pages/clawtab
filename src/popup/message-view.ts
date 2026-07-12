import type { ChatMessage } from '../shared/types';
import { t } from '../shared/i18n';
import { messagesElement } from './dom';
import { updateCitationsSection } from './citation-view';
import { renderMarkdown } from './markdown-renderer';
import { clearMessageCopyTexts, renderMessageCopyButton } from './message-copy';
import { patchMessageSections } from './message-view-patcher';
import { getToolRenderer } from './tools';
import { escapeHtml } from './tools/render-utils';

export function renderMessages(history: ChatMessage[]): void {
  if (!messagesElement) {
    return;
  }

  clearMessageCopyTexts();
  messagesElement.innerHTML = history
    .map((message) => renderMessage(message))
    .join('');

  decorateHistoryCitations(history);

  messagesElement.scrollTop = messagesElement.scrollHeight;
}

export function renderRealtimeMessage(message: ChatMessage): void {
  if (!messagesElement) {
    return;
  }

  const existing = messagesElement.querySelector<HTMLElement>(
    `[data-message-id="${escapeCssAttributeValue(message.cid)}"]`,
  );

  if (existing) {
    patchMessageSections(existing, message);
  } else {
    messagesElement.insertAdjacentHTML('beforeend', renderMessage(message));
    if (message.role === 'assistant') {
      const inserted = messagesElement.querySelector<HTMLElement>(
        `[data-message-id="${escapeCssAttributeValue(message.cid)}"]`,
      );
      if (inserted) {
        updateCitationsSection(inserted, message);
      }
    }
  }

  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function renderMessage(message: ChatMessage): string {
  let roleClass = 'assistant';
  if (message.role === 'user') {
    roleClass = 'user';
  }

  const className = `message message--${roleClass}`;
  const toolCallsHtml =
    message.role === 'assistant' && message.toolCalls?.length
      ? renderToolCallsSection(message.toolCalls)
      : '';
  const reasoningHtml =
    message.role === 'assistant' && message.reasoning?.trim()
      ? renderReasoningSection(message.reasoning)
      : '';
  const contentHtml = renderContentSection(message);
  // Citations section is inserted after the article is attached, via
  // updateCitationsSection, so we can inspect real anchors + decorate sups.
  const copyHtml = renderMessageCopyButton(message);

  return `<article class="${className}" data-message-id="${escapeHtml(
    message.cid,
  )}">${toolCallsHtml}${reasoningHtml}${contentHtml}${copyHtml}</article>`;
}

function decorateHistoryCitations(history: ChatMessage[]): void {
  const root = messagesElement;
  if (!root) {
    return;
  }
  history.forEach((message) => {
    if (message.role !== 'assistant') {
      return;
    }
    const article = root.querySelector<HTMLElement>(
      `[data-message-id="${escapeCssAttributeValue(message.cid)}"]`,
    );
    if (article) {
      updateCitationsSection(article, message);
    }
  });
}

function escapeCssAttributeValue(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

export function renderToolCallsSection(
  toolCalls: NonNullable<ChatMessage['toolCalls']>,
): string {
  return `<div class="message__tools">${renderToolCallItems(toolCalls)}</div>`;
}

export function renderToolCallItems(
  toolCalls: NonNullable<ChatMessage['toolCalls']>,
): string {
  return toolCalls
    .filter(
      (toolCall) => toolCall.event === 'result' || toolCall.event === 'error',
    )
    .map((toolCall) => getToolRenderer(toolCall).render())
    .join('');
}

export function renderReasoningSection(reasoning: string): string {
  return `<details class="message__reasoning"><summary>${escapeHtml(
    t('message_reasoning'),
  )}</summary><div>${escapeHtml(reasoning)}</div></details>`;
}

export function renderContentSection(message: ChatMessage): string {
  const content = resolveMessageContent(message);
  return message.role === 'assistant'
    ? `<div class="message__markdown">${renderMarkdown(content)}</div>`
    : `<div class="message__plain">${escapeHtml(content)}</div>`;
}

/**
 * Prefer a translation key when present — assistant welcome messages are
 * seeded with `contentKey` so they re-localize when the user switches locales.
 * Everything else (user input, streamed LLM output) resolves to literal
 * `content` as stored.
 */
function resolveMessageContent(message: ChatMessage): string {
  if (message.contentKey) {
    return t(message.contentKey);
  }
  return message.content;
}
