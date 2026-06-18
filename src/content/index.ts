import { defaultLogger } from '../lib/logger';
import { ignoreErrors, scope } from '../lib/sentry-setup';
import type { ContentSnapshotMessage } from '../shared/types';
import { getInstance } from './content-extractor/extractor-factory';

/** 扩展重载/禁用后 runtime 不可用；访问 id 也可能抛错 */
function isExtensionRuntimeReachable(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function isExtensionContextInvalidatedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('Extension context invalidated')
  );
}

async function sendSnapshot(): Promise<void> {
  if (!isExtensionRuntimeReachable()) {
    defaultLogger.debug(
      'ClawTab snapshot skipped (extension context invalidated).',
    );
    return;
  }
  const url = window.location.href;
  const body = document.body;
  const extractor = getInstance({ url, body });
  if (!extractor) {
    defaultLogger.warn('No suitable content extractor found for this page.');
    return;
  }
  const result = await extractor.extract();
  const message: ContentSnapshotMessage = {
    type: 'content/snapshot',
    snapshot: {
      url: location.href,
      title: document.title,
      text: result.text,
      updatedAt: Date.now(),
    },
  };

  await chrome.runtime.sendMessage(message);
  defaultLogger.info(
    'ClawTab snapshot sent successfully:',
    message.snapshot.title,
    message.snapshot.url,
  );
}
function doSendSnapshot(): void {
  sendSnapshot().catch((error) => {
    if (isExtensionContextInvalidatedError(error)) {
      defaultLogger.debug(
        'ClawTab snapshot skipped (extension context invalidated).',
      );
      return;
    }
    scope.captureException(error);
    defaultLogger.error('ClawTab snapshot failed:', error);
  });
}
if (
  document.readyState === 'complete' ||
  document.readyState === 'interactive'
) {
  doSendSnapshot();
} else {
  window.addEventListener(
    'load',
    () => {
      doSendSnapshot();
    },
    { once: true },
  );
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    doSendSnapshot();
  }
});

window.addEventListener('popstate', () => {
  doSendSnapshot();
});
window.addEventListener('hashchange', () => {
  doSendSnapshot();
});

function captureException(errPrefix: string, error: Error | string): void {
  const errMsg = error instanceof Error ? error.message : String(error);
  if (ignoreErrors.includes(errMsg)) {
    return;
  }
  scope.captureException(error);
  defaultLogger.error(errPrefix, (error as Error).stack || error);
}

window.addEventListener('error', (e) => {
  captureException(
    'ClawTab content script error:',
    (e.error as Error) || e.message,
  );
});

window.addEventListener('unhandledrejection', (e) => {
  captureException(
    'ClawTab content script unhandled rejection:',
    e.reason as Error,
  );
});
