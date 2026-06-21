import type { GetConfigRequest, LlmConfig } from '../../shared/types';
import { getConfig } from '../storage';
import type { BackgroundMessageHandler, RuntimeHandlerContext } from './types';

interface GetConfigResponse {
  ok: true;
  config: LlmConfig;
}

export const getConfigHandler: BackgroundMessageHandler<
  GetConfigRequest,
  GetConfigResponse,
  RuntimeHandlerContext
> = {
  type: 'config/get',
  async process() {
    return {
      ok: true,
      config: await getConfig(),
    };
  },
};
