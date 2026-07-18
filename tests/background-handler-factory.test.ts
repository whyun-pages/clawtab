import { describe, expect, it } from 'vitest';
import {
  getBackgroundMessageHandler,
  getRuntimeMessageHandler,
  getStreamMessageHandler,
} from '../src/background/handlers/factory';
import type {
  ChatStreamClientMessage,
  RuntimeMessage,
} from '../src/shared/types';

describe('background handler factory', () => {
  it.each([
    'content/snapshot',
    'chat/state:get',
    'config/get',
    'config/save',
    'preferences/get',
    'preferences/save',
    'chat/stream:start',
    'session/list',
    'session/create',
    'session/switch',
    'session/delete',
    'session/rename',
  ] as const)('returns a handler for %s', (type) => {
    const handler = getBackgroundMessageHandler(type);

    expect(handler?.type).toBe(type);
    expect(typeof handler?.process).toBe('function');
  });

  it('returns null for unknown message types', () => {
    const handler = getBackgroundMessageHandler('unknown/type' as never);

    expect(handler).toBeNull();
  });

  it('returns runtime handlers for runtime messages', () => {
    const message = {
      type: 'chat/state:get',
    } satisfies RuntimeMessage;

    const handler = getRuntimeMessageHandler(message);

    expect(handler?.type).toBe('chat/state:get');
  });

  it('returns stream handlers for stream messages', () => {
    const message = {
      type: 'chat/stream:start',
      requestId: 'request-1',
      message: 'hello',
    } satisfies ChatStreamClientMessage;

    const handler = getStreamMessageHandler(message);

    expect(handler?.type).toBe('chat/stream:start');
  });
});
