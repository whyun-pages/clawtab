import type {
  GetChatStateResponse,
  ResetChatStateRequest,
} from '../../shared/types';
import { getConfig, resetHistory } from '../storage';
import type { BackgroundMessageHandler, RuntimeHandlerContext } from './types';

export const resetChatStateHandler: BackgroundMessageHandler<
  ResetChatStateRequest,
  GetChatStateResponse,
  RuntimeHandlerContext
> = {
  type: 'chat/state:reset',
  async process() {
    const [config, history] = await Promise.all([getConfig(), resetHistory()]);

    return {
      ok: true,
      config,
      history,
    };
  },
};
