import type {
  SessionCreateRequest,
  SessionCreateResponse,
} from '../../shared/types';
import { getMessages } from '../message-store';
import { createSession, setCurrentSid } from '../session-store';
import type { BackgroundMessageHandler, RuntimeHandlerContext } from './types';

export const sessionCreateHandler: BackgroundMessageHandler<
  SessionCreateRequest,
  SessionCreateResponse,
  RuntimeHandlerContext
> = {
  type: 'session/create',
  async process(message) {
    const session = await createSession(message.title);
    await setCurrentSid(session.sid);
    const history = await getMessages(session.sid);

    return {
      ok: true,
      session,
      history,
      currentSid: session.sid,
    };
  },
};
