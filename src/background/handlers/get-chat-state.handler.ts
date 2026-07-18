import type {
  GetChatStateRequest,
  GetChatStateResponse,
} from '../../shared/types';
import { getMessages } from '../message-store';
import { getCurrentSid, listSessions } from '../session-store';
import { getConfig } from '../storage';
import { getUserPreferences } from '../../shared/preferences';
import type { BackgroundMessageHandler, RuntimeHandlerContext } from './types';

export const getChatStateHandler: BackgroundMessageHandler<
  GetChatStateRequest,
  GetChatStateResponse,
  RuntimeHandlerContext
> = {
  type: 'chat/state:get',
  async process() {
    const [config, preferences, currentSid] = await Promise.all([
      getConfig(),
      getUserPreferences(),
      getCurrentSid(),
    ]);
    const [history, sessions] = await Promise.all([
      getMessages(currentSid),
      listSessions(),
    ]);

    return {
      ok: true,
      config,
      preferences,
      history,
      currentSid,
      sessions,
    };
  },
};
