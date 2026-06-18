import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, stepCountIs } from 'ai';
import {
  tabSnapshotGetTool,
  tabSnapshotListIdsTool,
} from '../ai/tools/tab-snapshot.tool';
import { defaultLogger } from '../lib/logger';
import type { ChatMessage, LlmConfig } from '../shared/types';

export async function requestLlm(
  config: LlmConfig,
  messages: ChatMessage[],
): Promise<string> {
  const provider = createOpenAICompatible({
    name: 'clawtab',
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  });

  try {
    const { text } = await generateText({
      model: provider.chatModel(config.model),
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      tools: {
        tabSnapshotListIdsTool,
        tabSnapshotGetTool,
      },
      toolChoice: 'required',
      stopWhen: stepCountIs(5),
      experimental_onToolCallStart: ({ stepNumber, toolCall }) => {
        defaultLogger.info(
          `LLM tool call started at step ${stepNumber}: ${String(toolCall.toolName)}`,
          toolCall.input,
        );
      },
      experimental_onToolCallFinish: ({
        stepNumber,
        toolCall,
        success,
        durationMs,
        ...event
      }) => {
        if (success) {
          defaultLogger.info(
            `LLM tool call finished at step ${stepNumber}: ${String(toolCall.toolName)} (${durationMs}ms)`,
            event.output,
          );
          return;
        }

        defaultLogger.error(
          `LLM tool call failed at step ${stepNumber}: ${String(toolCall.toolName)} (${durationMs}ms)`,
          event.error,
        );
      },
      onStepFinish: ({ finishReason, text, toolCalls, toolResults }) => {
        defaultLogger.info('LLM step finished', {
          finishReason,
          textLength: text.length,
          toolCallCount: toolCalls.length,
          toolResultCount: toolResults.length,
        });
      },
    });

    if (text.trim()) {
      return text;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`大模型请求失败: ${message}`, { cause: error });
  }

  throw new Error('大模型返回了空响应。');
}
