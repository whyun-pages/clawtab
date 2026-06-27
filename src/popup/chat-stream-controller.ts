import type {
  ChatMessage,
  ChatStreamClientMessage,
  ChatStreamServerMessage,
  ToolStreamDelta,
} from '../shared/types';
import { CHAT_STREAM_PORT } from '../shared/types';

interface ChatStreamContext {
  setHistory(history: ChatMessage[]): void;
  renderHistory(): void;
  renderRealtimeMessage(message: ChatMessage): void;
  setSubmitting(isSubmitting: boolean): void;
}

let activePort: chrome.runtime.Port | null = null;
let activeRequestId: string | null = null;
let activeAssistantMessage: ChatMessage | null = null;

export function startChatStream(
  message: string,
  context: ChatStreamContext,
): void {
  stopChatStream();

  const requestId = crypto.randomUUID();
  const userMessageId = crypto.randomUUID();
  const assistantMessageId = crypto.randomUUID();
  activeRequestId = requestId;
  activeAssistantMessage = {
    cid: assistantMessageId,
    sid: '',
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
    seq: 0,
  };
  context.setSubmitting(true);

  context.renderRealtimeMessage({
    cid: userMessageId,
    sid: '',
    role: 'user',
    content: message,
    createdAt: Date.now(),
    seq: 0,
  });
  context.renderRealtimeMessage(activeAssistantMessage);

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
    return;
  }

  if (message.type === 'chat/stream:delta') {
    if (!activeAssistantMessage) {
      return;
    }

    if (message.deltaType === 'reasoning') {
      activeAssistantMessage.reasoning =
        (activeAssistantMessage.reasoning ?? '') + message.delta;
    } else if (message.deltaType === 'answer') {
      activeAssistantMessage.content += message.delta;
    } else if (message.deltaType === 'tool') {
      if (isCompletedToolCall(message.delta)) {
        activeAssistantMessage.toolCalls = [
          ...(activeAssistantMessage.toolCalls ?? []),
          message.delta,
        ];
      }
    }
    context.renderRealtimeMessage(activeAssistantMessage);
    return;
  }

  if (message.type === 'chat/stream:done') {
    context.setHistory(message.history);
    context.renderHistory();
    stopChatStream();
    context.setSubmitting(false);
    return;
  }

  if (activeAssistantMessage) {
    activeAssistantMessage.content = message.message;
    context.renderRealtimeMessage(activeAssistantMessage);
  }
  stopChatStream();
  context.setSubmitting(false);
}

function clearActiveStream(): void {
  activePort = null;
  activeRequestId = null;
  activeAssistantMessage = null;
}

function isCompletedToolCall(
  delta: ToolStreamDelta,
): delta is Extract<ToolStreamDelta, { event: 'result' | 'error' }> {
  return delta.event === 'result' || delta.event === 'error';
}
