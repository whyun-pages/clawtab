export type SkillName = "shopping" | "social" | "video";

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
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OpenClawConfig {
  baseUrl: string;
  token: string;
  model: string;
  agentId: string;
  sessionKey: string;
}

export interface SkillDecision {
  skill: SkillName | null;
  reason: string;
}

export interface ConnectorResult {
  reply: string;
  decision: SkillDecision;
  relatedTabs: PageSnapshot[];
  mode: "gateway" | "config-required";
}

export interface SendChatRequest {
  type: "chat/send";
  message: string;
}

export interface SendChatResponse {
  ok: true;
  result: ConnectorResult;
  history: ChatMessage[];
}

export interface GetChatStateRequest {
  type: "chat/state:get";
}

export interface GetChatStateResponse {
  ok: true;
  history: ChatMessage[];
  config: OpenClawConfig;
}

export interface ResetChatStateRequest {
  type: "chat/state:reset";
}

export interface SaveConfigRequest {
  type: "config/save";
  config: OpenClawConfig;
}

export interface SaveConfigResponse {
  ok: true;
  config: OpenClawConfig;
}

export interface GetConfigRequest {
  type: "config/get";
}

export interface ContentSnapshotMessage {
  type: "content/snapshot";
  snapshot: Omit<PageSnapshot, "tabId">;
}

export type RuntimeMessage =
  | SendChatRequest
  | ContentSnapshotMessage
  | GetChatStateRequest
  | ResetChatStateRequest
  | SaveConfigRequest
  | GetConfigRequest;
