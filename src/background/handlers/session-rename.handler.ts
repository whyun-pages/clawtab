import type {
  SessionRenameRequest,
  SessionRenameResponse,
} from '../../shared/types';
import { renameSession } from '../session-store';
import type { BackgroundMessageHandler, RuntimeHandlerContext } from './types';

export const sessionRenameHandler: BackgroundMessageHandler<
  SessionRenameRequest,
  SessionRenameResponse,
  RuntimeHandlerContext
> = {
  type: 'session/rename',
  async process(message) {
    const session = await renameSession(message.sid, message.title);

    return {
      ok: true,
      session,
    };
  },
};
