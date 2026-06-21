import type { SendChatRequest, SendChatResponse } from '../../shared/types';
import { runConnector } from '../connector';
import { getConfig, getHistory, saveHistory } from '../storage';
import { listSnapshots } from '../tab-content-store';
import type { BackgroundMessageHandler, RuntimeHandlerContext } from './types';

export const sendChatHandler: BackgroundMessageHandler<
  SendChatRequest,
  SendChatResponse,
  RuntimeHandlerContext
> = {
  type: 'chat/send',
  async process(message) {
    const [config, history] = await Promise.all([getConfig(), getHistory()]);
    const userEntry = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: message.message,
    };
    const result = await runConnector(
      message.message,
      listSnapshots(),
      config,
      history,
    );
    const nextHistory = await saveHistory([
      ...history,
      userEntry,
      {
        id: crypto.randomUUID(),
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
