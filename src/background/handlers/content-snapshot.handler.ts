import type { ContentSnapshotMessage } from '../../shared/types';
import { upsertSnapshot } from '../tab-content-store';
import type { BackgroundMessageHandler, RuntimeHandlerContext } from './types';

export const contentSnapshotHandler: BackgroundMessageHandler<
  ContentSnapshotMessage,
  { ok: true },
  RuntimeHandlerContext
> = {
  type: 'content/snapshot',
  process(message, context) {
    const tabId = context.sender.tab?.id;

    if (typeof tabId === 'number') {
      upsertSnapshot({
        tabId,
        ...message.snapshot,
      });
    }

    return { ok: true };
  },
};
