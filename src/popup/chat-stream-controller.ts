import type {
  ChatMessage,
  ChatStreamClientMessage,
  ChatStreamServerMessage,
} from '../shared/types';
import { CHAT_STREAM_PORT } from '../shared/types';

interface ChatStreamContext {
  appendToHistory(message: ChatMessage): void;
  renderRealtimeMessage(message: ChatMessage): void;
  setSubmitting(isSubmitting: boolean): void;
}

let activePort: chrome.runtime.Port | null = null;
let activeRequestId: string | null = null;
let activeUserMessage: ChatMessage | null = null;
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
  activeUserMessage = {
    cid: userMessageId,
    sid: '',
    role: 'user',
    content: message,
    createdAt: Date.now(),
    seq: 0,
  };
  activeAssistantMessage = {
    cid: assistantMessageId,
    sid: '',
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
    seq: 0,
  };
  context.setSubmitting(true);

  context.renderRealtimeMessage(activeUserMessage);
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
    assistantMessageId,
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
      activeAssistantMessage.toolCalls = [
        ...(activeAssistantMessage.toolCalls ?? []),
        message.delta,
      ];
    }
    context.renderRealtimeMessage(activeAssistantMessage);
    return;
  }

  if (message.type === 'chat/stream:done') {
    // 流完成，只更新状态，不重新渲染（DOM 已在流式过程中完成）
    if (activeUserMessage && activeAssistantMessage) {
      activeUserMessage.sid = message.sid;
      activeAssistantMessage.sid = message.sid;

      // 将临时消息添加到历史
      context.appendToHistory(activeUserMessage);
      context.appendToHistory(activeAssistantMessage);
    }

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
  activeUserMessage = null;
  activeAssistantMessage = null;
}
