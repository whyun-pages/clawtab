import type {
  SavePreferencesRequest,
  SavePreferencesResponse,
} from '../../shared/types';
import { saveUserPreferences } from '../../shared/preferences';
import type { BackgroundMessageHandler, RuntimeHandlerContext } from './types';

export const savePreferencesHandler: BackgroundMessageHandler<
  SavePreferencesRequest,
  SavePreferencesResponse,
  RuntimeHandlerContext
> = {
  type: 'preferences/save',
  async process(message) {
    return {
      ok: true,
      preferences: await saveUserPreferences(message.preferences),
    };
  },
};
