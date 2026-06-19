export type SkillName = 'shopping' | 'social' | 'video';

export type TabId = number;

export interface PageSnapshot {
  tabId: TabId;
  url: string;
  title: string;
  text: string;
  updatedAt: number;
  videoUrl?: string;
  audioUrl?: string;
  subtitles?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  toolCalls?: ToolStreamDelta[];
}

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface SkillDecision {
  skill: SkillName | null;
  reason: string;
}

export interface ConnectorResult {
  reply: string;
  reasoning?: string;
  toolCalls?: ToolStreamDelta[];
  decision: SkillDecision;
  relatedTabs: PageSnapshot[];
  mode: 'gateway' | 'config-required';
}

export interface SendChatRequest {
  type: 'chat/send';
  message: string;
}

export interface SendChatResponse {
  ok: true;
  result: ConnectorResult;
  history: ChatMessage[];
}

export const CHAT_STREAM_PORT = 'chat/stream';

export type LlmStreamDeltaType = 'answer' | 'reasoning' | 'tool';

export type ToolStreamDelta =
  | {
      event: 'call';
      toolCallId: string;
      toolName: string;
      input: unknown;
    }
  | {
      event: 'input-start';
      toolCallId: string;
      toolName: string;
    }
  | {
      event: 'input-delta';
      toolCallId: string;
      toolName?: string;
      delta: string;
    }
  | {
      event: 'input-end';
      toolCallId: string;
      toolName?: string;
    }
  | {
      event: 'result';
      toolCallId: string;
      toolName: string;
      input: unknown;
      output: unknown;
    }
  | {
      event: 'error';
      toolCallId: string;
      toolName: string;
      input: unknown;
      error: unknown;
    };

export interface ChatStreamStartMessage {
  type: 'chat/stream:start';
  requestId: string;
  message: string;
}

export interface ChatStreamStartedMessage {
  type: 'chat/stream:started';
  requestId: string;
  assistantMessageId: string;
}

export type ChatStreamDeltaMessage =
  | {
      type: 'chat/stream:delta';
      requestId: string;
      deltaType: 'answer' | 'reasoning';
      delta: string;
    }
  | {
      type: 'chat/stream:delta';
      requestId: string;
      deltaType: 'tool';
      delta: ToolStreamDelta;
    };

export interface ChatStreamDoneMessage {
  type: 'chat/stream:done';
  requestId: string;
  result: ConnectorResult;
  history: ChatMessage[];
}

export interface ChatStreamErrorMessage {
  type: 'chat/stream:error';
  requestId: string;
  message: string;
}

export type ChatStreamClientMessage = ChatStreamStartMessage;

export type ChatStreamServerMessage =
  | ChatStreamStartedMessage
  | ChatStreamDeltaMessage
  | ChatStreamDoneMessage
  | ChatStreamErrorMessage;

export interface GetChatStateRequest {
  type: 'chat/state:get';
}

export interface GetChatStateResponse {
  ok: true;
  history: ChatMessage[];
  config: LlmConfig;
}

export interface ResetChatStateRequest {
  type: 'chat/state:reset';
}

export interface SaveConfigRequest {
  type: 'config/save';
  config: LlmConfig;
}

export interface SaveConfigResponse {
  ok: true;
  config: LlmConfig;
}

export interface GetConfigRequest {
  type: 'config/get';
}

export interface ContentSnapshotMessage {
  type: 'content/snapshot';
  snapshot: Omit<PageSnapshot, 'tabId'>;
}

export type RuntimeMessage =
  | SendChatRequest
  | ContentSnapshotMessage
  | GetChatStateRequest
  | ResetChatStateRequest
  | SaveConfigRequest
  | GetConfigRequest;
