import type {
  GetChatStateRequest,
  GetChatStateResponse,
} from '../../shared/types';
import { getConfig, getHistory } from '../storage';
import type { BackgroundMessageHandler, RuntimeHandlerContext } from './types';

export const getChatStateHandler: BackgroundMessageHandler<
  GetChatStateRequest,
  GetChatStateResponse,
  RuntimeHandlerContext
> = {
  type: 'chat/state:get',
  async process() {
    const [config, history] = await Promise.all([getConfig(), getHistory()]);

    return {
      ok: true,
      config,
      history,
    };
  },
};
