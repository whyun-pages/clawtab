import type { LlmConfig } from '../shared/types';

const CONFIG_KEY = 'llm-config';

type StoredLlmConfig = Partial<LlmConfig> & {
  token?: string;
};

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  baseUrl: '',
  apiKey: '',
  model: '',
};

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

function asConfigString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}
