import type { ChatMessage, ToolStreamDelta } from '../shared/types';
import { updateCitationsSection } from './citation-view';
import { renderMarkdown } from './markdown-renderer';
import { renderMessageCopyButton } from './message-copy';
import {
  renderContentSection,
  renderReasoningSection,
  renderToolCallsSection,
} from './message-view';
import { getToolRenderer } from './tools';
import { escapeHtml } from './tools/render-utils';

export function patchMessageSections(
  article: HTMLElement,
  message: ChatMessage,
): void {
  updateToolCallsSection(article, message);
  updateReasoningSection(article, message);
  updateContentSection(article, message);
  updateCitationsSection(article, message);
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

  if (!shouldShow) {
    if (existing) {
      existing.remove();
    }
    return;
  }

  if (!existing) {
    article.insertAdjacentHTML(
      'afterbegin',
      renderToolCallsSection(message.toolCalls!),
    );
    return;
  }

  patchToolCallItems(existing, message.toolCalls!);
}

function patchToolCallItems(
  container: HTMLElement,
  toolCalls: NonNullable<ChatMessage['toolCalls']>,
): void {
  const renderable = toolCalls.filter(
    (toolCall) => toolCall.event === 'result' || toolCall.event === 'error',
  );

  const existingNodes = new Map<string, HTMLElement>();
  container
    .querySelectorAll<HTMLElement>(':scope > .message__tool-call')
    .forEach((node) => {
      const id = node.dataset.toolCallId;
      if (id) {
        existingNodes.set(id, node);
      }
    });

  const desiredIds = new Set<string>();

  renderable.forEach((toolCall, index) => {
    const id = toolCall.toolCallId;
    desiredIds.add(id);
    const renderer = getToolRenderer(toolCall);
    const existingNode = existingNodes.get(id);

    if (!existingNode) {
      const html = renderer.render();
      const referenceNode = container.children[index] as
        | HTMLElement
        | undefined;
      if (referenceNode) {
        referenceNode.insertAdjacentHTML('beforebegin', html);
      } else {
        container.insertAdjacentHTML('beforeend', html);
      }
      return;
    }

    updateToolCallNodeContent(existingNode, renderer, toolCall);

    const desiredAtIndex = container.children[index];
    if (desiredAtIndex !== existingNode) {
      if (desiredAtIndex) {
        container.insertBefore(existingNode, desiredAtIndex);
      } else {
        container.appendChild(existingNode);
      }
    }
  });

  existingNodes.forEach((node, id) => {
    if (!desiredIds.has(id)) {
      node.remove();
    }
  });
}

function updateToolCallNodeContent(
  node: HTMLElement,
  renderer: ReturnType<typeof getToolRenderer>,
  toolCall: ToolStreamDelta,
): void {
  const signature = computeToolCallSignature(toolCall);
  if (node.dataset.toolCallSignature === signature) {
    return;
  }
  node.dataset.toolCallSignature = signature;

  const inputPre = node.querySelector<HTMLElement>(
    ':scope > .message__tool-input',
  );
  if (inputPre) {
    inputPre.textContent = renderer.input;
  }

  const outputContainer = node.querySelector<HTMLElement>(
    ':scope > .message__tool-output',
  );
  if (outputContainer) {
    const outputContent = renderer.output ?? '';
    if (renderer.isOutputHtml) {
      outputContainer.innerHTML = outputContent;
    } else {
      outputContainer.textContent = outputContent;
    }
  }
}

function computeToolCallSignature(toolCall: ToolStreamDelta): string {
  return JSON.stringify({
    event: toolCall.event,
    input: 'input' in toolCall ? toolCall.input : null,
    output: 'output' in toolCall ? toolCall.output : null,
    error: 'error' in toolCall ? toolCall.error : null,
  });
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
      if (inner.dataset.reasoningText !== message.reasoning) {
        inner.dataset.reasoningText = message.reasoning!;
        inner.innerHTML = escapeHtml(message.reasoning!);
      }
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
