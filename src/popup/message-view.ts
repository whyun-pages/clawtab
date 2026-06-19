import type { ChatMessage } from '../shared/types';
import { messagesElement } from './dom';
import { getToolRenderer } from './tools';
import { escapeHtml } from './tools/render-utils';

export function renderMessages(history: ChatMessage[]): void {
  if (!messagesElement) {
    return;
  }

  messagesElement.innerHTML = history
    .map((message) => renderMessage(message))
    .join('');

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
    reasoningHtml = `<details class="message__reasoning" open><summary>思考过程</summary><div>${escapeHtml(
      message.reasoning,
    )}</div></details>`;
  }

  let toolCallsHtml = '';
  if (message.role === 'assistant' && message.toolCalls?.length) {
    toolCallsHtml = renderToolCalls(message.toolCalls);
  }

  return `<article class="${className}">${reasoningHtml}${escapeHtml(
    message.content,
  )}${toolCallsHtml}</article>`;
}

function renderToolCalls(
  toolCalls: NonNullable<ChatMessage['toolCalls']>,
): string {
  const items = toolCalls
    .map((toolCall) => getToolRenderer(toolCall).render(toolCall))
    .join('');

  return `<div class="message__tools">${items}</div>`;
}
