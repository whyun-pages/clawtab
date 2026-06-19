import type {
  LlmConfig,
  SaveConfigRequest,
  SaveConfigResponse,
} from '../shared/types';
import {
  apiKeyInput,
  baseUrlInput,
  configForm,
  configStatus,
  modelInput,
} from './dom';

type ConfigSavedHandler = (config: LlmConfig) => void;

export function bindConfigForm(onConfigSaved: ConfigSavedHandler): void {
  configForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    void saveConfigFromForm(onConfigSaved);
  });
}

async function saveConfigFromForm(
  onConfigSaved: ConfigSavedHandler,
): Promise<void> {
  const request: SaveConfigRequest = {
    type: 'config/save',
    config: readConfigForm(),
  };
  const response: SaveConfigResponse =
    await chrome.runtime.sendMessage(request);

  hydrateConfig(response.config);
  setConfigStatus(buildConfigStatus(response.config));
  onConfigSaved(response.config);
}

export function readConfigForm(): LlmConfig {
  return {
    baseUrl: baseUrlInput?.value.trim() || '',
    apiKey: apiKeyInput?.value.trim() || '',
    model: modelInput?.value.trim() || '',
  };
}

export function hydrateConfig(config: LlmConfig): void {
  if (baseUrlInput) {
    baseUrlInput.value = config.baseUrl;
  }
  if (apiKeyInput) {
    apiKeyInput.value = config.apiKey;
  }
  if (modelInput) {
    modelInput.value = config.model;
  }
}

export function setConfigStatus(value: string): void {
  if (configStatus) {
    configStatus.textContent = value;
  }
}

export function buildConfigStatus(config: LlmConfig): string {
  if (!config.apiKey) {
    return '未配置 API Key，发送消息时不会调用真实大模型接口。';
  }

  return `已配置 ${config.baseUrl}，模型 ${config.model}。`;
}
