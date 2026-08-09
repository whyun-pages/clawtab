import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ChatStreamClientMessage,
  ChatStreamServerMessage,
} from '../src/shared/types';
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
    expect(context.appendToHistory).not.toHaveBeenCalled();
  });

  it('appends the streamed messages to history without re-rendering when the stream is done', async () => {
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
      delta: '最终回答',
    });

    const renderCallsBeforeDone =
      context.renderRealtimeMessage.mock.calls.length;

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
    });

    expect(context.appendToHistory).toHaveBeenCalledTimes(2);
    expect(context.appendToHistory).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sid: 'sess-1',
        role: 'user',
        content: '问题',
      }),
    );
    expect(context.appendToHistory).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sid: 'sess-1',
        role: 'assistant',
        content: '最终回答',
      }),
    );
    expect(context.renderRealtimeMessage).toHaveBeenCalledTimes(
      renderCallsBeforeDone,
    );
    expect(context.setSubmitting).toHaveBeenLastCalledWith(false);
  });
});

function createContext() {
  return {
    appendToHistory: vi.fn(),
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
      addListener: vi.fn(
        (listener: (message: ChatStreamServerMessage) => void) => {
          messageListeners.push(listener);
        },
      ),
    },
    onDisconnect: {
      addListener: vi.fn((listener: () => void) => {
        disconnectListeners.push(listener);
      }),
    },
    postMessage: vi.fn<(message: ChatStreamClientMessage) => void>(),
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

function getStartedRequestId(port: {
  postMessage: Mock<(message: ChatStreamClientMessage) => void>;
}): string {
  expect(chrome.runtime.connect).toHaveBeenCalledWith({
    name: CHAT_STREAM_PORT,
  });

  return port.postMessage.mock.calls[0][0].requestId;
}
