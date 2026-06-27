import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, ChatStreamServerMessage } from '../src/shared/types';
import { CHAT_STREAM_PORT } from '../src/shared/types';

describe('popup chat stream controller', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders stream deltas into the realtime assistant placeholder only', async () => {
    const { port, messageListeners } = stubChromePort();
    const { startChatStream } =
      await import('../src/popup/chat-stream-controller');
    const context = createContext();

    startChatStream('问题', context);
    const requestId = getStartedRequestId(port);

    messageListeners[0]({
      type: 'chat/stream:delta',
      requestId,
      deltaType: 'answer',
      delta: '回答',
    });

    expect(context.renderRealtimeMessage).toHaveBeenCalledTimes(3);
    expect(context.renderRealtimeMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: '回答',
      }),
    );
    expect(context.setHistory).not.toHaveBeenCalled();
    expect(context.renderHistory).not.toHaveBeenCalled();
  });

  it('syncs final history and renders history once when the stream is done', async () => {
    const { port, messageListeners } = stubChromePort();
    const { startChatStream } =
      await import('../src/popup/chat-stream-controller');
    const context = createContext();
    const history: ChatMessage[] = [
      {
        cid: 'user-final',
        sid: 'sess-1',
        role: 'user',
        content: '问题',
        createdAt: 0,
        seq: 0,
      },
      {
        cid: 'assistant-final',
        sid: 'sess-1',
        role: 'assistant',
        content: '最终回答',
        createdAt: 1,
        seq: 1,
      },
    ];

    startChatStream('问题', context);
    const requestId = getStartedRequestId(port);

    messageListeners[0]({
      type: 'chat/stream:done',
      requestId,
      sid: 'sess-1',
      result: {
        reply: '最终回答',
        decision: { skill: null, reason: '' },
        relatedTabs: [],
        mode: 'gateway',
      },
      history,
    });

    expect(context.setHistory).toHaveBeenCalledWith(history);
    expect(context.renderHistory).toHaveBeenCalledTimes(1);
  });
});

function createContext() {
  return {
    setHistory: vi.fn(),
    renderHistory: vi.fn(),
    renderRealtimeMessage: vi.fn(),
    setSubmitting: vi.fn(),
  };
}

function stubChromePort() {
  const messageListeners: Array<(message: ChatStreamServerMessage) => void> =
    [];
  const disconnectListeners: Array<() => void> = [];
  const port = {
    onMessage: {
      addListener: vi.fn((listener) => {
        messageListeners.push(listener);
      }),
    },
    onDisconnect: {
      addListener: vi.fn((listener) => {
        disconnectListeners.push(listener);
      }),
    },
    postMessage: vi.fn(),
    disconnect: vi.fn(() => {
      disconnectListeners.forEach((listener) => listener());
    }),
  };

  vi.stubGlobal('chrome', {
    runtime: {
      connect: vi.fn(() => port),
    },
  });

  return { port, messageListeners };
}

function getStartedRequestId(port: { postMessage: ReturnType<typeof vi.fn> }) {
  expect(chrome.runtime.connect).toHaveBeenCalledWith({
    name: CHAT_STREAM_PORT,
  });

  return port.postMessage.mock.calls[0][0].requestId;
}
