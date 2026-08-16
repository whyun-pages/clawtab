import type { ChatMessage } from '../shared/types';
import { updateCitationsSection } from './citation-view';
import { renderMarkdown } from './markdown-renderer';
import { renderMessageCopyButton } from './message-copy';
import { renderContentSection, renderActivitySection } from './message-view';
import { getToolRenderer } from './tools';
import { escapeHtml } from './tools/render-utils';
import {
  toToolCallViews,
  formatDuration,
  type ToolCallView,
} from './tool-call-view';
import { syncActivityTicker } from './activity-ticker';
import { t } from '../shared/i18n';

export function patchMessageSections(
  article: HTMLElement,
  message: ChatMessage,
): void {
  updateActivitySection(article, message);
  updateContentSection(article, message);
  updateCitationsSection(article, message);
  updateCopyButton(article, message);
  syncActivityTicker(article);
}

function updateActivitySection(
  article: HTMLElement,
  message: ChatMessage,
): void {
  const shouldShow =
    message.role === 'assistant' &&
    (!!message.toolCalls?.length || !!message.reasoning?.trim());
  const existing = article.querySelector<HTMLDetailsElement>(
    ':scope > .message__activity',
  );

  if (!shouldShow) {
    if (existing) {
      existing.remove();
    }
    return;
  }

  if (!existing) {
    article.insertAdjacentHTML('afterbegin', renderActivitySection(message));
    return;
  }

  const views = toToolCallViews(message.toolCalls ?? []);
  updateActivitySummary(existing, views, message);
  updateActivityBody(existing, views, message);

  const answerStarted = !!message.content?.trim();
  if (!answerStarted) {
    existing.open = true;
  } else if (existing.dataset.autoCollapsed !== '1') {
    existing.open = false;
    existing.dataset.autoCollapsed = '1';
  }
}

function updateActivitySummary(
  details: HTMLDetailsElement,
  views: ToolCallView[],
  message: ChatMessage,
): void {
  const summary = details.querySelector<HTMLElement>(':scope > summary');
  if (!summary) {
    return;
  }

  const title = t('activity_title');
  const runningTool = views.find((v) => v.status === 'running');

  if (runningTool) {
    const toolName = runningTool.toolName ?? t('tool_unknown');
    const statusText = t('activity_running', toolName);
    const timeHtml = runningTool.startedAt
      ? `<span class="message__activity-time" data-activity-elapsed data-status="running" data-started-at="${runningTool.startedAt}">0ms</span>`
      : '';
    summary.innerHTML = `<span class="message__activity-title">${escapeHtml(title)}</span><span class="message__activity-status">${escapeHtml(statusText)}</span>${timeHtml}`;
    return;
  }

  const totalMs =
    (message.reasoningMs ?? 0) +
    views.reduce((sum, v) => sum + (v.durationMs ?? 0), 0);
  const summaryText =
    views.length > 0
      ? t('activity_summary', [
          String(views.length),
          totalMs > 0 ? formatDuration(totalMs) : '--',
        ])
      : t('activity_thinking');

  summary.innerHTML = `<span class="message__activity-title">${escapeHtml(title)}</span><span class="message__activity-status">${escapeHtml(summaryText)}</span>`;
}

function updateActivityBody(
  details: HTMLDetailsElement,
  views: ToolCallView[],
  message: ChatMessage,
): void {
  const body = details.querySelector<HTMLElement>(
    ':scope > .message__activity-body',
  );
  if (!body) {
    return;
  }

  updateThinkingRow(body, message);
  patchToolCallItems(body, views);
}

function updateThinkingRow(body: HTMLElement, message: ChatMessage): void {
  const shouldShow = !!message.reasoning?.trim();
  const existing = body.querySelector<HTMLElement>('.message__thinking');

  if (!shouldShow) {
    if (existing) {
      existing.remove();
    }
    return;
  }

  const reasoning = message.reasoning!;
  const reasoningMs = message.reasoningMs;
  const isRunning = !message.content?.trim();

  if (!existing) {
    const chip = isRunning ? '⟳' : '💭';
    const label = escapeHtml(t('activity_thinking'));
    const timeHtml = reasoningMs
      ? `<span class="message__activity-time">${escapeHtml(formatDuration(reasoningMs))}</span>`
      : isRunning
        ? `<span class="message__activity-time" data-thinking-elapsed data-status="running">0ms</span>`
        : '';

    const html = `<div class="message__thinking" data-thinking><span class="message__activity-chip" data-status="${isRunning ? 'running' : 'success'}">${chip}</span><span class="message__thinking-label">${label}</span>${timeHtml}<div class="message__thinking-text">${escapeHtml(reasoning)}</div></div>`;
    body.insertAdjacentHTML('afterbegin', html);
    return;
  }

  const textDiv = existing.querySelector<HTMLElement>(
    '.message__thinking-text',
  );
  if (textDiv && textDiv.textContent !== reasoning) {
    textDiv.textContent = reasoning;
  }

  const chip = existing.querySelector<HTMLElement>('.message__activity-chip');
  if (chip) {
    const newStatus = isRunning ? 'running' : 'success';
    if (chip.dataset.status !== newStatus) {
      chip.dataset.status = newStatus;
      chip.textContent = isRunning ? '⟳' : '💭';
    }
  }

  const timeSpan = existing.querySelector<HTMLElement>(
    '.message__activity-time',
  );
  if (reasoningMs && timeSpan) {
    timeSpan.textContent = formatDuration(reasoningMs);
    delete timeSpan.dataset.thinkingElapsed;
    delete timeSpan.dataset.status;
  }
}

function patchToolCallItems(
  container: HTMLElement,
  views: ToolCallView[],
): void {
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

  views.forEach((view, index) => {
    const id = view.toolCallId;
    desiredIds.add(id);
    const renderer = getToolRenderer(view.delta, view);
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

    updateToolCallNodeContent(existingNode, renderer, view);

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
  view: ToolCallView,
): void {
  const signature = computeToolCallSignature(view);
  if (node.dataset.toolCallSignature === signature) {
    return;
  }
  node.dataset.toolCallSignature = signature;

  const summary = node.querySelector<HTMLElement>(':scope > summary');
  if (summary) {
    const status = view.status;
    const statusChip =
      status === 'running' ? '⟳' : status === 'error' ? '✗' : '✓';
    const toolName = renderer.name;
    const durationMs = view.durationMs;

    const durationHtml =
      durationMs !== undefined
        ? `<span class="message__activity-time">${escapeHtml(formatDuration(durationMs))}</span>`
        : status === 'running' && view.startedAt
          ? `<span class="message__activity-time" data-tool-elapsed data-status="running" data-started-at="${view.startedAt}">0ms</span>`
          : '';

    summary.innerHTML = `<span class="message__activity-chip" data-status="${status}">${statusChip}</span><span class="message__tool-name">${escapeHtml(toolName)}</span>${durationHtml}`;
  }

  const inputPre = node.querySelector<HTMLElement>(
    ':scope > .message__tool-input',
  );
  if (inputPre) {
    inputPre.textContent = renderer.input;
  }

  const outputContainer = node.querySelector<HTMLElement>(
    ':scope > .message__tool-output',
  );
  const outputContent = renderer.output;

  if (outputContent !== undefined) {
    if (!outputContainer) {
      const inputEl = node.querySelector<HTMLElement>(
        ':scope > .message__tool-input, :scope > .message__tool-output',
      );
      const anchor = inputEl ?? node.querySelector<HTMLElement>(
        ':scope > .message__tool-label:last-of-type',
      );
      if (anchor) {
        const outputHtml = renderer.isOutputHtml
          ? `<div class="message__tool-label">${escapeHtml(t('tool_output'))}</div><div class="message__tool-output message__tool-output--html">${outputContent}</div>`
          : `<div class="message__tool-label">${escapeHtml(t('tool_output'))}</div><pre class="message__tool-output">${escapeHtml(outputContent)}</pre>`;
        anchor.insertAdjacentHTML('afterend', outputHtml);
      }
    } else {
      if (renderer.isOutputHtml) {
        outputContainer.innerHTML = outputContent;
      } else {
        outputContainer.textContent = outputContent;
      }
    }
  }
}

function computeToolCallSignature(view: ToolCallView): string {
  const delta = view.delta;
  return JSON.stringify({
    event: delta.event,
    status: view.status,
    input: 'input' in delta ? delta.input : null,
    output: 'output' in delta ? delta.output : null,
    error: 'error' in delta ? delta.error : null,
  });
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
