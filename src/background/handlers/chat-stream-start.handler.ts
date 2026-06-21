import type { ChatStreamClientMessage } from '../../shared/types';
import { runConnectorStream } from '../connector';
import { getConfig, getHistory, saveHistory } from '../storage';
import { listSnapshots } from '../tab-content-store';
import type { BackgroundMessageHandler, StreamHandlerContext } from './types';

export const chatStreamStartHandler: BackgroundMessageHandler<
  ChatStreamClientMessage,
  void,
  StreamHandlerContext
> = {
  type: 'chat/stream:start',
  async process(message, context) {
    const assistantMessageId = crypto.randomUUID();

    try {
      const [config, history] = await Promise.all([getConfig(), getHistory()]);
      const userEntry = {
        id: crypto.randomUUID(),
        role: 'user' as const,
        content: message.message,
      };

      if (!context.isConnected()) {
        return;
      }

      context.postToPort({
        type: 'chat/stream:started',
        requestId: message.requestId,
        assistantMessageId,
      });

      const result = await runConnectorStream(
        message.message,
        listSnapshots(),
        config,
        history,
        (part) => {
          if (!context.isConnected()) {
            return;
          }

          if (part.type === 'tool') {
            context.postToPort({
              type: 'chat/stream:delta',
              requestId: message.requestId,
              deltaType: 'tool',
              delta: part.delta,
            });
            return;
          }

          context.postToPort({
            type: 'chat/stream:delta',
            requestId: message.requestId,
            deltaType: part.type,
            delta: part.delta,
          });
        },
        context.abortSignal,
      );

      if (!context.isConnected()) {
        return;
      }

      const nextHistory = await saveHistory([
        ...history,
        userEntry,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: result.reply,
          ...(result.reasoning ? { reasoning: result.reasoning } : {}),
          ...(result.toolCalls ? { toolCalls: result.toolCalls } : {}),
        },
      ]);

      context.postToPort({
        type: 'chat/stream:done',
        requestId: message.requestId,
        result,
        history: nextHistory,
      });
    } catch (error) {
      if (context.abortSignal.aborted || !context.isConnected()) {
        return;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      context.postToPort({
        type: 'chat/stream:error',
        requestId: message.requestId,
        message: `请求失败：${errorMessage}`,
      });
    }
  },
};
