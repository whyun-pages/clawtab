import type { SendChatRequest, SendChatResponse } from '../../shared/types';
import { runConnector } from '../connector';
import { appendMessages, getMessages } from '../message-store';
import { getCurrentSid } from '../session-store';
import { getConfig } from '../storage';
import { listSnapshots } from '../tab-content-store';
import type { BackgroundMessageHandler, RuntimeHandlerContext } from './types';

export const sendChatHandler: BackgroundMessageHandler<
  SendChatRequest,
  SendChatResponse,
  RuntimeHandlerContext
> = {
  type: 'chat/send',
  async process(message) {
    const [config, currentSid] = await Promise.all([
      getConfig(),
      getCurrentSid(),
    ]);
    const history = await getMessages(currentSid);

    const result = await runConnector(
      message.message,
      listSnapshots(),
      config,
      history,
    );

    const nextHistory = await appendMessages(currentSid, [
      {
        role: 'user',
        content: message.message,
      },
      {
        role: 'assistant',
        content: result.reply,
      },
    ]);

    return {
      ok: true,
      result,
      history: nextHistory,
    };
  },
};
