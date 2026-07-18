import type {
  GetPreferencesRequest,
  GetPreferencesResponse,
} from '../../shared/types';
import { getUserPreferences } from '../../shared/preferences';
import type { BackgroundMessageHandler, RuntimeHandlerContext } from './types';

export const getPreferencesHandler: BackgroundMessageHandler<
  GetPreferencesRequest,
  GetPreferencesResponse,
  RuntimeHandlerContext
> = {
  type: 'preferences/get',
  async process() {
    return {
      ok: true,
      preferences: await getUserPreferences(),
    };
  },
};
