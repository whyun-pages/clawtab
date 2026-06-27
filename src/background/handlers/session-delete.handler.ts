import type {
  SessionDeleteRequest,
  SessionDeleteResponse,
} from '../../shared/types';
import { deleteSession, listSessions } from '../session-store';
import type { BackgroundMessageHandler, RuntimeHandlerContext } from './types';

export const sessionDeleteHandler: BackgroundMessageHandler<
  SessionDeleteRequest,
  SessionDeleteResponse,
  RuntimeHandlerContext
> = {
  type: 'session/delete',
  async process(message) {
    const { nextCurrentSid } = await deleteSession(message.sid);
    const sessions = await listSessions();

    return {
      ok: true,
      currentSid: nextCurrentSid,
      sessions,
    };
  },
};
