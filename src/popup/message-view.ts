import type { ChatMessage } from '../shared/types';
import { t } from '../shared/i18n';
import { messagesElement } from './dom';
import { updateCitationsSection } from './citation-view';
import { renderMarkdown } from './markdown-renderer';
import { clearMessageCopyTexts, renderMessageCopyButton } from './message-copy';
import { patchMessageSections } from './message-view-patcher';
import { getToolRenderer } from './tools';
import { escapeHtml } from './tools/render-utils';
import {
  toToolCallViews,
  formatDuration,
  type ToolCallView,
} from './tool-call-view';
import { syncActivityTicker } from './activity-ticker';

const AUTO_FOLLOW_BOTTOM_THRESHOLD_PX = 24;

let shouldAutoFollowMessages = true;
let scrollControlsElement: HTMLElement | null = null;
let newOutputButton: HTMLButtonElement | null = null;
let lastKnownScrollTop = 0;

export function renderMessages(history: ChatMessage[]): void {
  if (!messagesElement) {
    return;
  }

  ensureScrollControls();
  clearMessageCopyTexts();
  messagesElement.innerHTML = history
    .map((message) => renderMessage(message))
    .join('');
  ensureNewOutputButton();

  decorateHistoryCitations(history);
  syncActivityTicker(messagesElement);

  scrollMessagesToBottom();
}

export function renderRealtimeMessage(message: ChatMessage): void {
  if (!messagesElement) {
    return;
  }

  ensureScrollControls();
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

  scrollMessagesToBottom();
}

/**
 * Scrolls the messages container to the very bottom. Because search-result
 * tables embed product images that load asynchronously, a single scroll right
 * after innerHTML lands too early (scrollHeight is still short). We scroll
 * immediately, again after the next layout frame, and once more when each
 * pending image finishes loading.
 */
function scrollMessagesToBottom(): void {
  if (!messagesElement) {
    return;
  }

  if (!shouldAutoFollowMessages) {
    showNewOutputButton();
    return;
  }

  const el = messagesElement;
  const toBottom = (): void => {
    if (!shouldAutoFollowMessages) {
      showNewOutputButton();
      return;
    }
    el.scrollTop = el.scrollHeight;
    lastKnownScrollTop = el.scrollTop;
    hideNewOutputButton();
  };

  toBottom();

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(toBottom));
  }

  el.querySelectorAll('img').forEach((img) => {
    if (!img.complete) {
      img.addEventListener('load', toBottom, { once: true });
    }
  });
}

function ensureScrollControls(): void {
  if (!messagesElement || scrollControlsElement === messagesElement) {
    updateNewOutputButtonLabel();
    return;
  }

  scrollControlsElement = messagesElement;
  lastKnownScrollTop = messagesElement.scrollTop;
  messagesElement.addEventListener('wheel', handleMessagesWheel, {
    passive: true,
  });
  messagesElement.addEventListener('scroll', handleMessagesScroll);
  ensureNewOutputButton();
}

function handleMessagesWheel(event: WheelEvent): void {
  if (event.deltaY < 0) {
    pauseAutoFollow();
    ensureNewOutputButton();
  }
}

function handleMessagesScroll(): void {
  if (!messagesElement) {
    return;
  }

  const currentScrollTop = messagesElement.scrollTop;
  if (currentScrollTop < lastKnownScrollTop) {
    pauseAutoFollow();
  } else if (isScrolledNearBottom(messagesElement)) {
    shouldAutoFollowMessages = true;
    hideNewOutputButton();
  }
  lastKnownScrollTop = currentScrollTop;
}

function pauseAutoFollow(): void {
  shouldAutoFollowMessages = false;
}

function isScrolledNearBottom(el: HTMLElement): boolean {
  return (
    el.scrollHeight - el.scrollTop - el.clientHeight <=
    AUTO_FOLLOW_BOTTOM_THRESHOLD_PX
  );
}

function ensureNewOutputButton(): HTMLButtonElement | null {
  if (!messagesElement) {
    return null;
  }

  const parent =
    messagesElement.closest('.app') ?? messagesElement.parentElement;
  if (!parent) {
    return null;
  }

  if (newOutputButton?.parentElement === parent) {
    updateNewOutputButtonLabel();
    return newOutputButton;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'messages__new-output';
  button.hidden = true;
  button.innerHTML =
    '<span class="messages__new-output-icon" aria-hidden="true"></span>';
  button.addEventListener('click', () => {
    shouldAutoFollowMessages = true;
    hideNewOutputButton();
    scrollMessagesToBottom();
  });

  newOutputButton = button;
  updateNewOutputButtonLabel();
  parent.append(button);
  return button;
}

function updateNewOutputButtonLabel(): void {
  if (!newOutputButton) {
    return;
  }

  newOutputButton.setAttribute('aria-label', t('message_new_output'));
  newOutputButton.title = t('message_new_output');
}

function showNewOutputButton(): void {
  const button = ensureNewOutputButton();
  if (button) {
    button.hidden = false;
  }
}

function hideNewOutputButton(): void {
  if (newOutputButton) {
    newOutputButton.hidden = true;
  }
}

function renderMessage(message: ChatMessage): string {
  let roleClass = 'assistant';
  if (message.role === 'user') {
    roleClass = 'user';
  }

  const className = `message message--${roleClass}`;
  const activityHtml =
    message.role === 'assistant' &&
    (message.toolCalls?.length || message.reasoning?.trim())
      ? renderActivitySection(message)
      : '';
  const contentHtml = renderContentSection(message);
  // Citations section is inserted after the article is attached, via
  // updateCitationsSection, so we can inspect real anchors + decorate sups.
  const copyHtml = renderMessageCopyButton(message);

  return `<article class="${className}" data-message-id="${escapeHtml(
    message.cid,
  )}">${activityHtml}${contentHtml}${copyHtml}</article>`;
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
  const views = toToolCallViews(toolCalls);
  return views
    .map((view) => getToolRenderer(view.delta, view).render())
    .join('');
}

export function renderActivitySection(message: ChatMessage): string {
  const views = toToolCallViews(message.toolCalls ?? []);
  const hasTools = views.length > 0;
  const hasReasoning = !!message.reasoning?.trim();

  if (!hasTools && !hasReasoning) {
    return '';
  }

  const open = !message.content?.trim();
  const summaryHtml = renderActivitySummary(views, message);
  const bodyHtml = renderActivityBody(views, message);

  return `<details class="message__activity"${open ? ' open' : ''}><summary>${summaryHtml}</summary><div class="message__activity-body">${bodyHtml}</div></details>`;
}

function renderActivitySummary(
  views: ToolCallView[],
  message: ChatMessage,
): string {
  const title = `<span class="message__activity-title">${escapeHtml(t('activity_title'))}</span>`;

  const runningTool = views.find((v) => v.status === 'running');
  if (runningTool) {
    const toolName = runningTool.toolName ?? t('tool_unknown');
    const statusText = `<span class="message__activity-status">${escapeHtml(t('activity_running', toolName))}</span>`;
    const timeHtml = runningTool.startedAt
      ? `<span class="message__activity-time" data-activity-elapsed data-status="running" data-started-at="${runningTool.startedAt}">0ms</span>`
      : '';
    return `${title}${statusText}${timeHtml}`;
  }

  const totalMs =
    (message.reasoningMs ?? 0) +
    views.reduce((sum, v) => sum + (v.durationMs ?? 0), 0);
  const summary =
    views.length > 0
      ? t('activity_summary', [
          String(views.length),
          totalMs > 0 ? formatDuration(totalMs) : '--',
        ])
      : t('activity_thinking');

  return `${title}<span class="message__activity-status">${escapeHtml(summary)}</span>`;
}

function renderActivityBody(
  views: ToolCallView[],
  message: ChatMessage,
): string {
  const thinkingHtml = message.reasoning?.trim()
    ? renderThinkingRow(message)
    : '';
  const toolsHtml = views
    .map((view) => getToolRenderer(view.delta, view).render())
    .join('');
  return thinkingHtml + toolsHtml;
}

function renderThinkingRow(message: ChatMessage): string {
  const reasoning = message.reasoning!;
  const reasoningMs = message.reasoningMs;
  const isRunning = !message.content?.trim();

  const chip = isRunning ? '⟳' : '💭';
  const label = escapeHtml(t('activity_thinking'));
  const timeHtml = reasoningMs
    ? `<span class="message__activity-time">${escapeHtml(formatDuration(reasoningMs))}</span>`
    : isRunning
      ? `<span class="message__activity-time" data-thinking-elapsed data-status="running">0ms</span>`
      : '';

  return `<div class="message__thinking" data-thinking><span class="message__activity-chip" data-status="${isRunning ? 'running' : 'success'}">${chip}</span><span class="message__thinking-label">${label}</span>${timeHtml}<div class="message__thinking-text">${escapeHtml(reasoning)}</div></div>`;
}

export function renderReasoningSection(
  reasoning: string,
  open = false,
): string {
  return `<details class="message__reasoning"${
    open ? ' open' : ''
  }><summary>${escapeHtml(
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
