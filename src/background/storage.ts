import type { ChatMessage, LlmConfig } from '../shared/types';

const CONFIG_KEY = 'llm-config';
const HISTORY_KEY = 'chat-history';

type StoredLlmConfig = Partial<LlmConfig> & {
  token?: string;
};

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  baseUrl: '',
  apiKey: '',
  model: '',
};

const DEFAULT_HISTORY: ChatMessage[] = [
  {
    id: crypto.randomUUID(),
    role: 'assistant',
    content:
      '你好，我是 ClawTab。先在设置里填入大模型 Base URL 和 API Key，我就会通过真实的大模型接口来回答你。',
  },
];

export async function getConfig(): Promise<LlmConfig> {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  const config = stored[CONFIG_KEY] as StoredLlmConfig | undefined;
  const apiKey = config?.apiKey ?? config?.token ?? DEFAULT_LLM_CONFIG.apiKey;

  return {
    baseUrl: asConfigString(config?.baseUrl, DEFAULT_LLM_CONFIG.baseUrl),
    apiKey: asConfigString(apiKey, DEFAULT_LLM_CONFIG.apiKey),
    model: asConfigString(config?.model, DEFAULT_LLM_CONFIG.model),
  };
}

export async function saveConfig(config: LlmConfig): Promise<LlmConfig> {
  const normalized: LlmConfig = {
    baseUrl: asConfigString(config.baseUrl, DEFAULT_LLM_CONFIG.baseUrl).replace(
      /\/+$/,
      '',
    ),
    apiKey: asConfigString(config.apiKey, DEFAULT_LLM_CONFIG.apiKey).trim(),
    model:
      asConfigString(config.model, DEFAULT_LLM_CONFIG.model).trim() ||
      DEFAULT_LLM_CONFIG.model,
  };

  await chrome.storage.local.set({
    [CONFIG_KEY]: normalized,
  });

  return normalized;
}

export async function getHistory(): Promise<ChatMessage[]> {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const history = stored[HISTORY_KEY] as ChatMessage[] | undefined;
  return history && history.length > 0 ? history : DEFAULT_HISTORY;
}

export async function saveHistory(
  history: ChatMessage[],
): Promise<ChatMessage[]> {
  await chrome.storage.local.set({
    [HISTORY_KEY]: history,
  });
  return history;
}

export async function resetHistory(): Promise<ChatMessage[]> {
  await chrome.storage.local.remove(HISTORY_KEY);
  return DEFAULT_HISTORY;
}

function asConfigString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}
