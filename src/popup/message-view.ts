import type { ChatMessage } from '../shared/types';
import { messagesElement } from './dom';
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
  const copyHtml = renderMessageCopyButton(message);

  return `<article class="${className}" data-message-id="${escapeHtml(
    message.cid,
  )}">${toolCallsHtml}${reasoningHtml}${contentHtml}${copyHtml}</article>`;
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
  return `<details class="message__reasoning"><summary>思考过程</summary><div>${escapeHtml(
    reasoning,
  )}</div></details>`;
}

export function renderContentSection(message: ChatMessage): string {
  return message.role === 'assistant'
    ? `<div class="message__markdown">${renderMarkdown(message.content)}</div>`
    : `<div class="message__plain">${escapeHtml(message.content)}</div>`;
}
