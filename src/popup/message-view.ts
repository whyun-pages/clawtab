import type { ChatMessage } from '../shared/types';
import { messagesElement } from './dom';
import { renderMarkdown } from './markdown-renderer';
import { clearMessageCopyTexts, renderMessageCopyButton } from './message-copy';
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

  const html = renderMessage(message);
  const existingMessage = messagesElement.querySelector(
    `[data-message-id="${escapeCssAttributeValue(message.id)}"]`,
  );

  if (existingMessage) {
    existingMessage.outerHTML = html;
  } else {
    messagesElement.insertAdjacentHTML('beforeend', html);
  }

  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function renderMessage(message: ChatMessage): string {
  let roleClass = 'assistant';
  if (message.role === 'user') {
    roleClass = 'user';
  }

  const className = `message message--${roleClass}`;
  let reasoningHtml = '';
  if (message.role === 'assistant' && message.reasoning?.trim()) {
    reasoningHtml = `<details class="message__reasoning"><summary>思考过程</summary><div>${escapeHtml(
      message.reasoning,
    )}</div></details>`;
  }

  let toolCallsHtml = '';
  if (message.role === 'assistant' && message.toolCalls?.length) {
    toolCallsHtml = renderToolCalls(message.toolCalls);
  }

  const contentHtml =
    message.role === 'assistant'
      ? `<div class="message__markdown">${renderMarkdown(message.content)}</div>`
      : `<div class="message__plain">${escapeHtml(message.content)}</div>`;
  const copyHtml = renderMessageCopyButton(message);

  return `<article class="${className}" data-message-id="${escapeHtml(
    message.id,
  )}">${toolCallsHtml}${reasoningHtml}${contentHtml}${copyHtml}</article>`;
}

function escapeCssAttributeValue(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function renderToolCalls(
  toolCalls: NonNullable<ChatMessage['toolCalls']>,
): string {
  const items = toolCalls
    .filter(
      (toolCall) => toolCall.event === 'result' || toolCall.event === 'error',
    )
    .map((toolCall) => getToolRenderer(toolCall).render())
    .join('');

  return `<div class="message__tools">${items}</div>`;
}
