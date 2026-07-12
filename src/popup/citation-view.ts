import type { ChatMessage, TabActivateRequest } from '../shared/types';
import { messagesElement } from './dom';
import { type CitationEntry, extractInlineCitations } from './citations';
import { escapeHtml } from './tools/render-utils';

const CITATION_DATA_URL = 'data-cite-url';
const CITATION_DATA_TAB_ID = 'data-cite-tab-id';

/**
 * Renders the "引用来源" footer list for an assistant message. Returns an empty
 * string when there are no citations, so the caller can inline the result.
 */
export function renderCitationsSection(entries: CitationEntry[]): string {
  if (entries.length === 0) {
    return '';
  }

  const items = entries.map((entry) => renderCitationItem(entry)).join('');

  return `<section class="message__citations"><p class="message__citations__title">引用来源</p><ol class="message__citations__list">${items}</ol></section>`;
}

function renderCitationItem(entry: CitationEntry): string {
  const tabIdAttr =
    typeof entry.tabId === 'number'
      ? ` ${CITATION_DATA_TAB_ID}="${escapeHtml(String(entry.tabId))}"`
      : '';
  return (
    `<li class="message__citations__item-wrap">` +
    `<a class="message__citation-item" href="${escapeHtml(entry.url)}" ${CITATION_DATA_URL}="${escapeHtml(entry.url)}"${tabIdAttr} rel="noopener noreferrer" target="_blank">` +
    `<span class="message__citation-index">${entry.index}</span>` +
    `<span class="message__citation-title" title="${escapeHtml(entry.title)}">${escapeHtml(entry.title)}</span>` +
    `<span class="message__citation-host">${escapeHtml(entry.host)}</span>` +
    `</a></li>`
  );
}

/**
 * After DOMPurify has processed the markdown, decorate matching <a> nodes with a
 * clickable superscript badge. This runs post-render so we can use tags/attrs
 * that are not on the DOMPurify allowlist.
 */
export function decorateInlineCitations(
  markdownEl: HTMLElement,
  entries: CitationEntry[],
): void {
  if (entries.length === 0) {
    return;
  }

  const byUrl = new Map(entries.map((entry) => [entry.url, entry] as const));
  const anchors = markdownEl.querySelectorAll<HTMLAnchorElement>('a[href]');
  const decorated = new Set<string>();

  anchors.forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (!href) {
      return;
    }
    const normalized = safeNormalize(href);
    if (!normalized) {
      return;
    }
    const entry = byUrl.get(normalized);
    if (!entry) {
      return;
    }

    if (
      anchor.nextElementSibling instanceof HTMLElement &&
      anchor.nextElementSibling.classList.contains('citation-sup') &&
      anchor.nextElementSibling.getAttribute(CITATION_DATA_URL) === entry.url
    ) {
      decorated.add(entry.url);
      return;
    }

    const sup = document.createElement('sup');
    sup.className = 'citation-sup';
    sup.textContent = `[${entry.index}]`;
    sup.setAttribute(CITATION_DATA_URL, entry.url);
    if (typeof entry.tabId === 'number') {
      sup.setAttribute(CITATION_DATA_TAB_ID, String(entry.tabId));
    }
    anchor.insertAdjacentElement('afterend', sup);
    decorated.add(entry.url);
  });
}

function safeNormalize(href: string): string | null {
  try {
    const url = new URL(href.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Recomputes citations for a message and reconciles both the sup badges in the
 * markdown body and the footer list under the article.
 */
export function updateCitationsSection(
  article: HTMLElement,
  message: ChatMessage,
): void {
  if (message.role !== 'assistant') {
    return;
  }

  // In DOM-less test environments the mocked article may not expose
  // querySelector; skip decoration entirely rather than throwing.
  if (typeof article.querySelector !== 'function') {
    return;
  }

  const markdownEl = article.querySelector<HTMLElement>(
    ':scope > .message__markdown',
  );
  if (!markdownEl) {
    return;
  }

  const entries = extractInlineCitations(markdownEl, message);

  const existing = article.querySelector<HTMLElement>(
    ':scope > .message__citations',
  );

  if (entries.length === 0) {
    if (existing) {
      existing.remove();
    }
    return;
  }

  const html = renderCitationsSection(entries);
  if (existing) {
    existing.outerHTML = html;
  } else {
    const actions = article.querySelector<HTMLElement>(
      ':scope > .message__actions',
    );
    if (actions) {
      actions.insertAdjacentHTML('beforebegin', html);
    } else {
      article.insertAdjacentHTML('beforeend', html);
    }
  }

  decorateInlineCitations(markdownEl, entries);
}

/**
 * One-time delegated click handler on the messages container. Any element with
 * data-cite-url triggers the tab/activate runtime message; the click's default
 * navigation is prevented so we can hand off to background instead.
 */
export function bindCitationActions(): void {
  if (!messagesElement) {
    return;
  }

  messagesElement.addEventListener('click', (event) => {
    const target = event.target;
    if (!isElementLike(target)) {
      return;
    }

    const trigger = target.closest<HTMLElement>(`[${CITATION_DATA_URL}]`);
    if (!trigger) {
      return;
    }

    const url = trigger.getAttribute(CITATION_DATA_URL);
    if (!url) {
      return;
    }

    event.preventDefault();

    const tabIdAttr = trigger.getAttribute(CITATION_DATA_TAB_ID);
    const tabId =
      tabIdAttr && /^-?\d+$/.test(tabIdAttr) ? Number(tabIdAttr) : undefined;

    const message: TabActivateRequest = {
      type: 'tab/activate',
      url,
      ...(typeof tabId === 'number' ? { tabId } : {}),
    };

    void chrome.runtime.sendMessage(message).catch(() => {
      // Fall back to opening the URL in a new tab if the runtime is
      // unavailable (e.g. background not yet awake in a rare edge case).
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  });
}

function isElementLike(
  target: EventTarget | null,
): target is Element & { closest: Element['closest'] } {
  return (
    typeof target === 'object' &&
    target !== null &&
    'closest' in target &&
    typeof (target as { closest?: unknown }).closest === 'function'
  );
}
