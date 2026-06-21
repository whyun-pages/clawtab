import type {
  ChatStreamClientMessage,
  RuntimeMessage,
} from '../../shared/types';
import { chatStreamStartHandler } from './chat-stream-start.handler';
import { contentSnapshotHandler } from './content-snapshot.handler';
import { getChatStateHandler } from './get-chat-state.handler';
import { getConfigHandler } from './get-config.handler';
import { resetChatStateHandler } from './reset-chat-state.handler';
import { saveConfigHandler } from './save-config.handler';
import { sendChatHandler } from './send-chat.handler';
import type {
  AnyBackgroundMessageHandler,
  BackgroundMessageType,
  RuntimeMessageHandler,
  StreamMessageHandler,
} from './types';

const handlerRegistry = new Map<
  BackgroundMessageType,
  AnyBackgroundMessageHandler
>([
  [contentSnapshotHandler.type, contentSnapshotHandler],
  [sendChatHandler.type, sendChatHandler],
  [getChatStateHandler.type, getChatStateHandler],
  [resetChatStateHandler.type, resetChatStateHandler],
  [getConfigHandler.type, getConfigHandler],
  [saveConfigHandler.type, saveConfigHandler],
  [chatStreamStartHandler.type, chatStreamStartHandler],
]);

export function getBackgroundMessageHandler(
  type: BackgroundMessageType,
): AnyBackgroundMessageHandler | null {
  return handlerRegistry.get(type) ?? null;
}

export function getRuntimeMessageHandler(
  message: RuntimeMessage,
): RuntimeMessageHandler | null {
  const handler = getBackgroundMessageHandler(message.type);
  return handler && isRuntimeMessageHandler(handler) ? handler : null;
}

export function getStreamMessageHandler(
  message: ChatStreamClientMessage,
): StreamMessageHandler | null {
  const handler = getBackgroundMessageHandler(message.type);
  return handler && isStreamMessageHandler(handler) ? handler : null;
}

function isRuntimeMessageHandler(
  handler: AnyBackgroundMessageHandler,
): handler is RuntimeMessageHandler {
  return handler.type !== 'chat/stream:start';
}

function isStreamMessageHandler(
  handler: AnyBackgroundMessageHandler,
): handler is StreamMessageHandler {
  return handler.type === 'chat/stream:start';
}
