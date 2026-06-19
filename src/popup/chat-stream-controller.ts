import type {
  ChatMessage,
  ChatStreamClientMessage,
  ChatStreamServerMessage,
  ToolStreamDelta,
} from '../shared/types';
import { CHAT_STREAM_PORT } from '../shared/types';

interface ChatStreamContext {
  appendMessage(
    role: ChatMessage['role'],
    content: string,
    id?: string,
  ): ChatMessage;
  replaceMessageId(previousId: string | null, nextId: string): void;
  setHistory(history: ChatMessage[]): void;
  updateMessage(
    messageId: string | null,
    updater: (currentContent: string) => string,
  ): void;
  updateMessageReasoning(
    messageId: string | null,
    updater: (currentReasoning: string) => string,
  ): void;
  appendMessageToolCall(
    messageId: string | null,
    toolCall: ToolStreamDelta,
  ): void;
  render(): void;
  setSubmitting(isSubmitting: boolean): void;
}

let activePort: chrome.runtime.Port | null = null;
let activeRequestId: string | null = null;
let activeAssistantMessageId: string | null = null;

export function startChatStream(
  message: string,
  context: ChatStreamContext,
): void {
  stopChatStream();

  const requestId = crypto.randomUUID();
  const assistantMessageId = crypto.randomUUID();
  activeRequestId = requestId;
  activeAssistantMessageId = assistantMessageId;
  context.setSubmitting(true);

  context.appendMessage('user', message);
  context.appendMessage('assistant', '', assistantMessageId);
  context.render();

  const port = chrome.runtime.connect({ name: CHAT_STREAM_PORT });
  activePort = port;

  port.onMessage.addListener((streamMessage: ChatStreamServerMessage) => {
    handleStreamMessage(streamMessage, context);
  });

  port.onDisconnect.addListener(() => {
    if (activePort !== port) {
      return;
    }

    clearActiveStream();
    context.setSubmitting(false);
  });

  const startMessage: ChatStreamClientMessage = {
    type: 'chat/stream:start',
    requestId,
    message,
  };
  port.postMessage(startMessage);
}

export function stopChatStream(): void {
  activePort?.disconnect();
  clearActiveStream();
}

function handleStreamMessage(
  message: ChatStreamServerMessage,
  context: ChatStreamContext,
): void {
  if (message.requestId !== activeRequestId) {
    return;
  }

  if (message.type === 'chat/stream:started') {
    context.replaceMessageId(
      activeAssistantMessageId,
      message.assistantMessageId,
    );
    activeAssistantMessageId = message.assistantMessageId;
    return;
  }

  if (message.type === 'chat/stream:delta') {
    if (message.deltaType === 'reasoning') {
      context.updateMessageReasoning(
        activeAssistantMessageId,
        (reasoning) => reasoning + message.delta,
      );
    } else if (message.deltaType === 'answer') {
      context.updateMessage(
        activeAssistantMessageId,
        (content) => content + message.delta,
      );
    } else if (message.deltaType === 'tool') {
      if (isCompletedToolCall(message.delta)) {
        context.appendMessageToolCall(activeAssistantMessageId, message.delta);
      }
    }
    context.render();
    return;
  }

  if (message.type === 'chat/stream:done') {
    context.setHistory(message.history);
    context.render();
    stopChatStream();
    context.setSubmitting(false);
    return;
  }

  context.updateMessage(activeAssistantMessageId, () => message.message);
  context.render();
  stopChatStream();
  context.setSubmitting(false);
}

function clearActiveStream(): void {
  activePort = null;
  activeRequestId = null;
  activeAssistantMessageId = null;
}

function isCompletedToolCall(
  delta: ToolStreamDelta,
): delta is Extract<ToolStreamDelta, { event: 'result' | 'error' }> {
  return delta.event === 'result' || delta.event === 'error';
}
