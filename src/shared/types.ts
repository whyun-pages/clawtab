export type SkillName = 'shopping' | 'social' | 'video';

export type TabId = number;
export type TabUrl = string;
export interface PageSnapshotBasicInfo {
  url: string;
  title: string;
}
export interface PageSnapshot extends PageSnapshotBasicInfo {
  tabId: TabId;
  text: string;
  updatedAt: number;
  videoUrl?: string;
  audioUrl?: string;
  subtitles?: string[];
}

export interface ChatMessage {
  cid: string;
  sid: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  /**
   * Optional i18n key. When set, renderers prefer t(contentKey) over `content`
   * so seed messages (e.g. the assistant welcome greeting) re-localize as the
   * user switches languages. Persisted alongside `content` for legacy fallback.
   */
  contentKey?: string;
  reasoning?: string;
  reasoningMs?: number;
  toolCalls?: ToolStreamDelta[];
  createdAt: number;
  seq: number;
}

export interface Session {
  sid: string;
  title: string;
  /**
   * Optional i18n key. Set for sessions the extension created with a default
   * title so they re-localize with the current UI language. Cleared once the
   * user renames the session, so user intent wins.
   */
  titleKey?: string;
  createdAt: number;
  updatedAt: number;
}

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type SearchResultDisplayMode = 'all' | 'related' | 'recommended';

export interface UserPreferences {
  searchResultDisplayMode: SearchResultDisplayMode;
}

export interface SkillDecision {
  skill: SkillName | null;
  reason: string;
}

export interface ConnectorResult {
  reply: string;
  reasoning?: string;
  reasoningMs?: number;
  toolCalls?: ToolStreamDelta[];
  decision: SkillDecision;
  relatedTabs: PageSnapshot[];
  mode: 'gateway' | 'config-required';
}

export const CHAT_STREAM_PORT = 'chat/stream';

export type LlmStreamDeltaType = 'answer' | 'reasoning' | 'tool';

export type ToolCallStreamDelta = {
  event: 'call';
  toolCallId: string;
  toolName: string;
  input: unknown;
  startedAt?: number;
};

export type ToolInputStartStreamDelta = {
  event: 'input-start';
  toolCallId: string;
  toolName: string;
  startedAt?: number;
};

export type ToolInputDeltaStreamDelta = {
  event: 'input-delta';
  toolCallId: string;
  toolName?: string;
  delta: string;
};

export type ToolInputEndStreamDelta = {
  event: 'input-end';
  toolCallId: string;
  toolName?: string;
};

export type ToolResultStreamDelta = {
  event: 'result';
  toolCallId: string;
  toolName: string;
  input: unknown;
  output: unknown;
  startedAt?: number;
  durationMs?: number;
};

export type ToolErrorStreamDelta = {
  event: 'error';
  toolCallId: string;
  toolName: string;
  input: unknown;
  error: unknown;
  startedAt?: number;
  durationMs?: number;
};

export type ToolStreamDelta =
  | ToolCallStreamDelta
  | ToolInputStartStreamDelta
  | ToolInputDeltaStreamDelta
  | ToolInputEndStreamDelta
  | ToolResultStreamDelta
  | ToolErrorStreamDelta;

export interface ChatStreamStartMessage {
  type: 'chat/stream:start';
  requestId: string;
  message: string;
  assistantMessageId: string;
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
  sid: string;
  result: ConnectorResult;
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
  preferences: UserPreferences;
  currentSid: string;
  sessions: Session[];
}

export interface SessionListRequest {
  type: 'session/list';
}

export interface SessionListResponse {
  ok: true;
  sessions: Session[];
  currentSid: string;
}

export interface SessionCreateRequest {
  type: 'session/create';
  title?: string;
}

export interface SessionCreateResponse {
  ok: true;
  session: Session;
  history: ChatMessage[];
  currentSid: string;
}

export interface SessionSwitchRequest {
  type: 'session/switch';
  sid: string;
}

export interface SessionSwitchResponse {
  ok: true;
  currentSid: string;
}

export interface SessionDeleteRequest {
  type: 'session/delete';
  sid: string;
}

export interface SessionDeleteResponse {
  ok: true;
  currentSid: string;
  sessions: Session[];
}

export interface SessionRenameRequest {
  type: 'session/rename';
  sid: string;
  title: string;
}

export interface SessionRenameResponse {
  ok: true;
  session: Session;
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

export interface GetPreferencesRequest {
  type: 'preferences/get';
}

export interface GetPreferencesResponse {
  ok: true;
  preferences: UserPreferences;
}

export interface SavePreferencesRequest {
  type: 'preferences/save';
  preferences: Partial<UserPreferences>;
}

export interface SavePreferencesResponse {
  ok: true;
  preferences: UserPreferences;
}

export interface ContentSnapshotMessage {
  type: 'content/snapshot';
  snapshot: Omit<PageSnapshot, 'tabId'>;
}

export interface TabActivateRequest {
  type: 'tab/activate';
  url: string;
  tabId?: TabId;
}

export interface TabActivateResponse {
  ok: true;
}

export type RuntimeMessage =
  | ContentSnapshotMessage
  | GetChatStateRequest
  | SaveConfigRequest
  | GetConfigRequest
  | GetPreferencesRequest
  | SavePreferencesRequest
  | SessionListRequest
  | SessionCreateRequest
  | SessionSwitchRequest
  | SessionDeleteRequest
  | SessionRenameRequest
  | TabActivateRequest;
