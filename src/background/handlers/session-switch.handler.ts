import type {
  SessionSwitchRequest,
  SessionSwitchResponse,
} from '../../shared/types';
import { setCurrentSid } from '../session-store';
import type { BackgroundMessageHandler, RuntimeHandlerContext } from './types';

export const sessionSwitchHandler: BackgroundMessageHandler<
  SessionSwitchRequest,
  SessionSwitchResponse,
  RuntimeHandlerContext
> = {
  type: 'session/switch',
  async process(message) {
    await setCurrentSid(message.sid);

    return {
      ok: true,
      currentSid: message.sid,
    };
  },
};
