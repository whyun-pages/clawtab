import type { ChatMessage, TabId, ToolStreamDelta } from '../shared/types';
import { ToolName } from '../ai/tools';

export interface CitationEntry {
  /** 1-based, order of first appearance in the rendered markdown DOM. */
  index: number;
  url: string;
  title: string;
  host: string;
  tabId?: TabId;
}

interface TabHint {
  title?: string;
  tabId?: TabId;
}

type ToolResultDelta = Extract<ToolStreamDelta, { event: 'result' }>;

/**
 * Builds a URL → { title, tabId } lookup by walking the assistant message's
 * completed tool calls. Only tool results are considered; per-URL info from
 * later calls wins (tabSnapshotGet gives the most reliable title).
 */
export function buildTabHintMap(message: ChatMessage): Map<string, TabHint> {
  const map = new Map<string, TabHint>();
  const toolCalls = message.toolCalls ?? [];

  for (const delta of toolCalls) {
    if (delta.event !== 'result') {
      continue;
    }
    applyToolResult(map, delta);
  }

  return map;
}

function applyToolResult(
  map: Map<string, TabHint>,
  delta: ToolResultDelta,
): void {
  if (delta.toolName === (ToolName.TabSnapshotListBasicTool as string)) {
    const items = extractListBasicOutput(delta.output);
    for (const item of items) {
      mergeHint(map, item.url, { title: item.title });
    }
    return;
  }
  if (delta.toolName === (ToolName.TabSnapshotGet as string)) {
    const data = extractSnapshotGetOutput(delta.output);
    if (data) {
      mergeHint(map, data.url, { title: data.title });
    }
    return;
  }
  if (delta.toolName === (ToolName.TabOpenInBackground as string)) {
    const data = extractOpenInBackgroundOutput(delta.output);
    if (data) {
      mergeHint(map, data.url, { tabId: data.tabId });
    }
    return;
  }
}

function mergeHint(
  map: Map<string, TabHint>,
  url: string,
  patch: TabHint,
): void {
  const existing = map.get(url) ?? {};
  map.set(url, {
    title: patch.title ?? existing.title,
    tabId: patch.tabId ?? existing.tabId,
  });
}

/**
 * Walks the rendered markdown container to enumerate citation-worthy links
 * (http/https, first occurrence), enriches them with hints from tool results,
 * and returns entries numbered 1..N.
 */
export function extractInlineCitations(
  markdownEl: HTMLElement,
  message: ChatMessage,
): CitationEntry[] {
  const hints = buildTabHintMap(message);
  const entries = new Map<string, CitationEntry>();

  const anchors = markdownEl.querySelectorAll<HTMLAnchorElement>('a[href]');
  anchors.forEach((anchor) => {
    const raw = anchor.getAttribute('href');
    if (!raw) {
      return;
    }
    const normalized = normalizeCitationUrl(raw);
    if (!normalized) {
      return;
    }
    if (entries.has(normalized)) {
      return;
    }

    const host = safeHost(normalized);
    const hint = hints.get(normalized);
    const title = pickTitle(hint?.title, anchor.textContent, host);

    entries.set(normalized, {
      index: entries.size + 1,
      url: normalized,
      title,
      host,
      tabId: hint?.tabId,
    });
  });

  return Array.from(entries.values());
}

function normalizeCitationUrl(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function pickTitle(
  fromHint: string | undefined,
  fromAnchorText: string | null,
  fallback: string,
): string {
  const hint = fromHint?.trim();
  if (hint) {
    return hint;
  }
  const anchor = fromAnchorText?.trim();
  if (anchor) {
    return anchor;
  }
  return fallback;
}

type ListBasicItem = { url: string; title: string };

function extractListBasicOutput(output: unknown): ListBasicItem[] {
  if (!isRecord(output)) {
    return [];
  }
  const data = output.data;
  if (!Array.isArray(data)) {
    return [];
  }
  const items: ListBasicItem[] = [];
  for (const entry of data) {
    if (isRecord(entry) && isString(entry.url) && isString(entry.title)) {
      items.push({ url: entry.url, title: entry.title });
    }
  }
  return items;
}

function extractSnapshotGetOutput(
  output: unknown,
): { url: string; title: string } | null {
  if (!isRecord(output) || !isRecord(output.data)) {
    return null;
  }
  const { url, title } = output.data;
  if (!isString(url) || !isString(title)) {
    return null;
  }
  return { url, title };
}

function extractOpenInBackgroundOutput(
  output: unknown,
): { url: string; tabId: TabId } | null {
  if (!isRecord(output) || !isRecord(output.data)) {
    return null;
  }
  const { url, tabId } = output.data;
  if (!isString(url) || typeof tabId !== 'number') {
    return null;
  }
  return { url, tabId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
