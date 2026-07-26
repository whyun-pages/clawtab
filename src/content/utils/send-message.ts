import { defaultLogger } from '../../lib/logger';
import type { RuntimeMessage } from '../../shared/types';

export interface SendMessageOptions {
  maxRetries?: number;
  retryDelayMs?: number;
}

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 300;

export async function sendMessage<TResponse = unknown>(
  message: RuntimeMessage,
  options: SendMessageOptions = {},
): Promise<TResponse> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await chrome.runtime?.sendMessage<RuntimeMessage, TResponse>(
        message,
      );
    } catch (error) {
      if (!isExtensionContextInvalidatedError(error)) {
        throw error;
      }
      if (attempt >= maxRetries) {
        throw error;
      }
      defaultLogger.debug(
        `sendMessage attempt ${attempt + 1} failed (extension context invalidated). Retrying in ${retryDelayMs}ms...`,
      );
      await delay(retryDelayMs);
    }
  }
}

export function isExtensionContextInvalidatedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message?.toLowerCase()?.includes('extension context invalidated')
  );
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
