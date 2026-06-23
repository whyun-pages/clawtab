import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeMessage } from '../src/shared/types';
import { sendMessage } from '../src/content/utils/send-message';

const message: RuntimeMessage = {
  type: 'content/snapshot',
  snapshot: {
    url: 'https://example.com',
    title: 'Example',
    text: 'Example content',
    updatedAt: 1,
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('content sendMessage utility', () => {
  it('sends the message successfully on the first attempt', async () => {
    const sendMessageMock = stubRuntimeSendMessage({ ok: true });

    await expect(sendMessage(message)).resolves.toEqual({ ok: true });

    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledWith(message);
  });

  it('retries and succeeds after an invalidated context error', async () => {
    const invalidatedError = new Error('Extension context invalidated.');
    const sendMessageMock = stubRuntimeSendMessageSequence([
      Promise.reject(invalidatedError),
      Promise.resolve({ ok: true }),
    ]);

    await expect(sendMessage(message, { retryDelayMs: 0 })).resolves.toEqual({
      ok: true,
    });

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
  });

  it('stops after the configured retry limit and rethrows the invalidated error', async () => {
    const invalidatedError = new Error('Extension context invalidated.');
    const sendMessageMock = stubRuntimeSendMessageSequence([
      Promise.reject(invalidatedError),
      Promise.reject(invalidatedError),
    ]);

    await expect(
      sendMessage(message, { maxRetries: 1, retryDelayMs: 0 }),
    ).rejects.toBe(invalidatedError);

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-invalidated errors', async () => {
    const error = new Error('The message port closed before a response.');
    const sendMessageMock = stubRuntimeSendMessage(Promise.reject(error));

    await expect(sendMessage(message, { retryDelayMs: 0 })).rejects.toBe(error);

    expect(sendMessageMock).toHaveBeenCalledTimes(1);
  });
});

function stubRuntimeSendMessage(response: unknown) {
  const sendMessageMock = vi.fn(() => response);

  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: sendMessageMock,
    },
  });

  return sendMessageMock;
}

function stubRuntimeSendMessageSequence(responses: unknown[]) {
  const sendMessageMock = vi.fn();

  for (const response of responses) {
    sendMessageMock.mockImplementationOnce(() => response);
  }

  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: sendMessageMock,
    },
  });

  return sendMessageMock;
}
