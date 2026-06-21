import type { SaveConfigRequest, SaveConfigResponse } from '../../shared/types';
import { saveConfig } from '../storage';
import type { BackgroundMessageHandler, RuntimeHandlerContext } from './types';

export const saveConfigHandler: BackgroundMessageHandler<
  SaveConfigRequest,
  SaveConfigResponse,
  RuntimeHandlerContext
> = {
  type: 'config/save',
  async process(message) {
    return {
      ok: true,
      config: await saveConfig(message.config),
    };
  },
};
