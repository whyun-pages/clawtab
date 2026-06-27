import type { ChatMessage, LlmConfig, ToolStreamDelta } from '../shared/types';

let history: ChatMessage[] = [];
let currentConfig: LlmConfig | null = null;

export function getHistory(): ChatMessage[] {
  return history;
}

export function setHistory(nextHistory: ChatMessage[]): void {
  history = nextHistory;
}

export function appendMessage(
  role: ChatMessage['role'],
  content: string,
  cid: string = crypto.randomUUID(),
): ChatMessage {
  const entry: ChatMessage = {
    cid,
    sid: '',
    role,
    content,
    createdAt: Date.now(),
    seq: history.length,
  };
  history.push(entry);
  return entry;
}

export function updateMessage(
  cid: string | null,
  updater: (currentContent: string) => string,
): void {
  if (!cid) {
    return;
  }

  const message = history.find((entry) => entry.cid === cid);
  if (message) {
    message.content = updater(message.content);
  }
}

export function updateMessageReasoning(
  cid: string | null,
  updater: (currentReasoning: string) => string,
): void {
  if (!cid) {
    return;
  }

  const message = history.find((entry) => entry.cid === cid);
  if (message) {
    message.reasoning = updater(message.reasoning ?? '');
  }
}

export function appendMessageToolCall(
  cid: string | null,
  toolCall: ToolStreamDelta,
): void {
  if (!cid) {
    return;
  }

  const message = history.find((entry) => entry.cid === cid);
  if (message) {
    message.toolCalls = [...(message.toolCalls ?? []), toolCall];
  }
}

export function replaceMessageCid(
  previousCid: string | null,
  nextCid: string,
): void {
  if (!previousCid || previousCid === nextCid) {
    return;
  }

  const message = history.find((entry) => entry.cid === previousCid);
  if (message) {
    message.cid = nextCid;
  }
}

export function getConfig(): LlmConfig | null {
  return currentConfig;
}

export function setConfig(config: LlmConfig): void {
  currentConfig = config;
}
