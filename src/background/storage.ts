import type { ChatMessage, OpenClawConfig } from "../shared/types";

const CONFIG_KEY = "openclaw-config";
const HISTORY_KEY = "chat-history";

export const DEFAULT_OPENCLAW_CONFIG: OpenClawConfig = {
  baseUrl: "http://127.0.0.1:18789/v1",
  token: "",
  model: "openclaw/default",
  agentId: "main",
  sessionKey: `clawtab-${crypto.randomUUID()}`
};

const DEFAULT_HISTORY: ChatMessage[] = [
  {
    id: crypto.randomUUID(),
    role: "assistant",
    content:
      "你好，我是 ClawTab。先在设置里填入 OpenClaw Gateway 地址和 Token，我就会通过真实的 OpenClaw connector 来回答你。"
  }
];

export async function getConfig(): Promise<OpenClawConfig> {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  return {
    ...DEFAULT_OPENCLAW_CONFIG,
    ...(stored[CONFIG_KEY] as Partial<OpenClawConfig> | undefined)
  };
}

export async function saveConfig(config: OpenClawConfig): Promise<OpenClawConfig> {
  const normalized: OpenClawConfig = {
    ...config,
    baseUrl: config.baseUrl.replace(/\/+$/, ""),
    model: config.model.trim() || DEFAULT_OPENCLAW_CONFIG.model,
    agentId: config.agentId.trim() || DEFAULT_OPENCLAW_CONFIG.agentId,
    sessionKey: config.sessionKey.trim() || `clawtab-${crypto.randomUUID()}`
  };

  await chrome.storage.local.set({
    [CONFIG_KEY]: normalized
  });

  return normalized;
}

export async function getHistory(): Promise<ChatMessage[]> {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const history = stored[HISTORY_KEY] as ChatMessage[] | undefined;
  return history && history.length > 0 ? history : DEFAULT_HISTORY;
}

export async function saveHistory(history: ChatMessage[]): Promise<ChatMessage[]> {
  await chrome.storage.local.set({
    [HISTORY_KEY]: history
  });
  return history;
}

export async function resetHistory(): Promise<ChatMessage[]> {
  await chrome.storage.local.remove(HISTORY_KEY);
  return DEFAULT_HISTORY;
}
