import type {
  ChatMessage,
  LlmConfig,
  ToolStreamDelta,
} from '../shared/types';

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
  id: string = crypto.randomUUID(),
): ChatMessage {
  const entry = {
    id,
    role,
    content,
  };
  history.push(entry);
  return entry;
}

export function updateMessage(
  messageId: string | null,
  updater: (currentContent: string) => string,
): void {
  if (!messageId) {
    return;
  }

  const message = history.find((entry) => entry.id === messageId);
  if (message) {
    message.content = updater(message.content);
  }
}

export function updateMessageReasoning(
  messageId: string | null,
  updater: (currentReasoning: string) => string,
): void {
  if (!messageId) {
    return;
  }

  const message = history.find((entry) => entry.id === messageId);
  if (message) {
    message.reasoning = updater(message.reasoning ?? '');
  }
}

export function appendMessageToolCall(
  messageId: string | null,
  toolCall: ToolStreamDelta,
): void {
  if (!messageId) {
    return;
  }

  const message = history.find((entry) => entry.id === messageId);
  if (message) {
    message.toolCalls = [...(message.toolCalls ?? []), toolCall];
  }
}

export function replaceMessageId(
  previousId: string | null,
  nextId: string,
): void {
  if (!previousId || previousId === nextId) {
    return;
  }

  const message = history.find((entry) => entry.id === previousId);
  if (message) {
    message.id = nextId;
  }
}

export function getConfig(): LlmConfig | null {
  return currentConfig;
}

export function setConfig(config: LlmConfig): void {
  currentConfig = config;
}
