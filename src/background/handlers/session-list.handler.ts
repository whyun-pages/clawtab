import type {
  SessionListRequest,
  SessionListResponse,
} from '../../shared/types';
import { getCurrentSid, listSessions } from '../session-store';
import type { BackgroundMessageHandler, RuntimeHandlerContext } from './types';

export const sessionListHandler: BackgroundMessageHandler<
  SessionListRequest,
  SessionListResponse,
  RuntimeHandlerContext
> = {
  type: 'session/list',
  async process() {
    const [sessions, currentSid] = await Promise.all([
      listSessions(),
      getCurrentSid(),
    ]);

    return {
      ok: true,
      sessions,
      currentSid,
    };
  },
};
