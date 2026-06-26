import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type {
  OnStepFinishEvent,
  OnToolCallFinishEvent,
  OnToolCallStartEvent,
} from 'ai';
import { generateText, stepCountIs, streamText } from 'ai';

import { gatewayTools, GatewayTools, ToolName } from '../ai/tools';
import { defaultLogger } from '../lib/logger';
import type { ChatMessage, LlmConfig, ToolStreamDelta } from '../shared/types';
import type { LlmStreamDelta } from './think-tag-parser';
import { ThinkTagParser } from './think-tag-parser';

type StreamDeltaHandler = (part: LlmStreamDelta) => void;
type ToolLlmStreamDelta = Extract<LlmStreamDelta, { type: 'tool' }>;
interface StreamLlmResult {
  text: string;
  reasoning?: string;
  toolCalls?: ToolStreamDelta[];
}

type GatewayOptions = Parameters<typeof streamText<GatewayTools>>[0] &
  Parameters<typeof generateText<GatewayTools>>[0];

function createProvider(config: LlmConfig) {
  return createOpenAICompatible({
    name: 'clawtab',
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  });
}

function buildGatewayOptions(
  config: LlmConfig,
  messages: ChatMessage[],
  abortSignal?: AbortSignal,
): GatewayOptions {
  const provider = createProvider(config);

  return {
    model: provider.chatModel(config.model),
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    tools: gatewayTools,
    toolChoice: 'auto' as const,
    stopWhen: stepCountIs(5),
    prepareStep: ({ stepNumber }: { stepNumber: number }) => {
      if (stepNumber === 0) {
        return {
          toolChoice: {
            type: 'tool' as const,
            toolName: ToolName.TabSnapshotListBasicTool,
          },
        };
      }
      if (stepNumber === 1) {
        return {
          toolChoice: {
            type: 'tool' as const,
            toolName: ToolName.TabSnapshotGet,
          },
        };
      }
      return {
        toolChoice: 'auto' as const,
      };
    },
    abortSignal,
    experimental_onToolCallStart: ({
      stepNumber,
      toolCall,
    }: OnToolCallStartEvent<GatewayTools>) => {
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
    }: OnToolCallFinishEvent<GatewayTools>) => {
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
    onStepFinish: ({
      finishReason,
      text,
      toolCalls,
      toolResults,
    }: OnStepFinishEvent<GatewayTools>) => {
      defaultLogger.info('LLM step finished', {
        finishReason,
        textLength: text.length,
        toolCallCount: toolCalls.length,
        toolResultCount: toolResults.length,
      });
    },
  };
}

export async function requestLlm(
  config: LlmConfig,
  messages: ChatMessage[],
): Promise<string> {
  try {
    const { text } = await generateText(buildGatewayOptions(config, messages));

    if (text.trim()) {
      return text;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`大模型请求失败: ${message}`, { cause: error });
  }

  throw new Error('大模型返回了空响应。');
}

export async function streamLlm(
  config: LlmConfig,
  messages: ChatMessage[],
  onDelta: StreamDeltaHandler,
  abortSignal?: AbortSignal,
): Promise<StreamLlmResult> {
  try {
    const result = streamText(
      buildGatewayOptions(config, messages, abortSignal),
    );
    const thinkTagParser = new ThinkTagParser();
    const toolNamesById = new Map<string, string>();
    const toolCalls: ToolStreamDelta[] = [];
    let text = '';
    let reasoning = '';

    for await (const part of result.fullStream) {
      if (part.type === 'reasoning-delta') {
        reasoning += part.text;
        onDelta({
          type: 'reasoning',
          delta: part.text,
        });
        continue;
      }

      const toolDelta = createToolDelta(part, toolNamesById);
      if (toolDelta) {
        if (isCompletedToolCall(toolDelta.delta)) {
          toolCalls.push(toolDelta.delta);
        }
        onDelta(toolDelta);
        continue;
      }

      if (part.type !== 'text-delta') {
        continue;
      }

      for (const parsedPart of thinkTagParser.push(part.text)) {
        if (parsedPart.type === 'reasoning') {
          reasoning += parsedPart.delta;
        } else {
          text += parsedPart.delta;
        }
        onDelta(parsedPart);
      }
    }

    for (const parsedPart of thinkTagParser.flush()) {
      if (parsedPart.type === 'reasoning') {
        reasoning += parsedPart.delta;
      } else {
        text += parsedPart.delta;
      }
      onDelta(parsedPart);
    }

    if (text.trim()) {
      const streamResult: StreamLlmResult = {
        text,
      };

      if (reasoning.trim()) {
        streamResult.reasoning = reasoning;
      }

      if (toolCalls.length > 0) {
        streamResult.toolCalls = toolCalls;
      }

      return streamResult;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`大模型请求失败: ${message}`, { cause: error });
  }

  throw new Error('大模型返回了空响应。');
}

type StreamPart =
  Awaited<
    ReturnType<typeof streamText<GatewayTools>>
  >['fullStream'] extends AsyncIterable<infer Part>
    ? Part
    : never;

function createToolDelta(
  part: StreamPart,
  toolNamesById: Map<string, string>,
): ToolLlmStreamDelta | null {
  if (part.type === 'tool-call') {
    toolNamesById.set(part.toolCallId, String(part.toolName));
    return {
      type: 'tool',
      delta: {
        event: 'call',
        toolCallId: part.toolCallId,
        toolName: String(part.toolName),
        input: part.input,
      },
    };
  }

  if (part.type === 'tool-input-start') {
    toolNamesById.set(part.id, String(part.toolName));
    return {
      type: 'tool',
      delta: {
        event: 'input-start',
        toolCallId: part.id,
        toolName: String(part.toolName),
      },
    };
  }

  if (part.type === 'tool-input-delta') {
    return {
      type: 'tool',
      delta: {
        event: 'input-delta',
        toolCallId: part.id,
        toolName: toolNamesById.get(part.id),
        delta: part.delta,
      },
    };
  }

  if (part.type === 'tool-input-end') {
    return {
      type: 'tool',
      delta: {
        event: 'input-end',
        toolCallId: part.id,
        toolName: toolNamesById.get(part.id),
      },
    };
  }

  if (part.type === 'tool-result') {
    toolNamesById.set(part.toolCallId, String(part.toolName));
    return {
      type: 'tool',
      delta: {
        event: 'result',
        toolCallId: part.toolCallId,
        toolName: String(part.toolName),
        input: part.input,
        output: part.output,
      },
    };
  }

  if (part.type === 'tool-error') {
    return {
      type: 'tool',
      delta: {
        event: 'error',
        toolCallId: part.toolCallId,
        toolName: String(part.toolName),
        input: part.input,
        error: part.error,
      },
    };
  }

  return null;
}

function isCompletedToolCall(
  delta: ToolStreamDelta,
): delta is Extract<ToolStreamDelta, { event: 'result' | 'error' }> {
  return delta.event === 'result' || delta.event === 'error';
}
