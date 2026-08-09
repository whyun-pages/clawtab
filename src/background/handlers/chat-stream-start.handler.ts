import type { ChatStreamClientMessage } from '../../shared/types';
import { runConnectorStream } from '../connector';
import { appendMessages, getMessages } from '../message-store';
import { getCurrentSid } from '../session-store';
import { getConfig } from '../storage';
import { listSnapshots } from '../tab-content-store';
import type { BackgroundMessageHandler, StreamHandlerContext } from './types';

export const chatStreamStartHandler: BackgroundMessageHandler<
  ChatStreamClientMessage,
  void,
  StreamHandlerContext
> = {
  type: 'chat/stream:start',
  async process(message, context) {
    try {
      const [config, currentSid, snapshots] = await Promise.all([
        getConfig(),
        getCurrentSid(),
        listSnapshots(),
      ]);
      const history = await getMessages(currentSid);

      if (!context.isConnected()) {
        return;
      }

      context.postToPort({
        type: 'chat/stream:started',
        requestId: message.requestId,
        assistantMessageId: message.assistantMessageId,
      });

      const result = await runConnectorStream(
        message.message,
        snapshots,
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
      // if (result.)

      await appendMessages(currentSid, [
        {
          role: 'user',
          content: message.message,
        },
        {
          cid: message.assistantMessageId,
          role: 'assistant',
          content: result.reply,
          ...(result.reasoning ? { reasoning: result.reasoning } : {}),
          ...(result.reasoningMs !== undefined
            ? { reasoningMs: result.reasoningMs }
            : {}),
          ...(result.toolCalls ? { toolCalls: result.toolCalls } : {}),
        },
      ]);

      context.postToPort({
        type: 'chat/stream:done',
        requestId: message.requestId,
        sid: currentSid,
        result,
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
