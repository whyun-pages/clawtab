import type {
  ChatStreamClientMessage,
  RuntimeMessage,
} from '../../shared/types';
import { chatStreamStartHandler } from './chat-stream-start.handler';
import { contentSnapshotHandler } from './content-snapshot.handler';
import { getChatStateHandler } from './get-chat-state.handler';
import { getConfigHandler } from './get-config.handler';
import { saveConfigHandler } from './save-config.handler';
import { sessionCreateHandler } from './session-create.handler';
import { sessionDeleteHandler } from './session-delete.handler';
import { sessionListHandler } from './session-list.handler';
import { sessionRenameHandler } from './session-rename.handler';
import { sessionSwitchHandler } from './session-switch.handler';
import { tabActivateHandler } from './tab-activate.handler';
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
  [getChatStateHandler.type, getChatStateHandler],
  [getConfigHandler.type, getConfigHandler],
  [saveConfigHandler.type, saveConfigHandler],
  [chatStreamStartHandler.type, chatStreamStartHandler],
  [sessionListHandler.type, sessionListHandler],
  [sessionCreateHandler.type, sessionCreateHandler],
  [sessionSwitchHandler.type, sessionSwitchHandler],
  [sessionDeleteHandler.type, sessionDeleteHandler],
  [sessionRenameHandler.type, sessionRenameHandler],
  [tabActivateHandler.type, tabActivateHandler],
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
