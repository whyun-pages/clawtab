import { defaultLogger } from '../lib/logger';
import { ignoreErrors, scope } from '../lib/sentry-setup';
import type { ContentMessage } from '../shared/content';
import type { ContentSnapshotMessage } from '../shared/types';
import { getInstance } from './content-extractor/extractor-factory';
import {
  isExtensionContextInvalidatedError,
  sendMessage,
} from './utils/send-message';

// /** 扩展重载/禁用后 runtime 不可用；访问 id 也可能抛错 */
// function isExtensionRuntimeReachable(): boolean {
//   try {
//     return Boolean(chrome.runtime?.id);
//   } catch {
//     return false;
//   }
// }

async function sendSnapshot(): Promise<void> {
  // if (!isExtensionRuntimeReachable()) {
  //   defaultLogger.debug(
  //     'ClawTab snapshot skipped (extension context invalidated).',
  //   );
  //   return;
  // }
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

  await sendMessage(message);
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
if (document.readyState === 'complete') {
  setTimeout(() => {
    defaultLogger.info(
      'ClawTab document readyState complete, sending snapshot...',
    );
    doSendSnapshot();
  }, 1000);
} else {
  window.addEventListener(
    'load',
    () => {
      defaultLogger.info(
        'ClawTab window load event detected, sending snapshot...',
      );
      doSendSnapshot();
    },
    { once: true },
  );
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    defaultLogger.info(
      'ClawTab visibilitychange event detected, sending snapshot...',
    );
    doSendSnapshot();
  }
});

window.addEventListener('popstate', () => {
  defaultLogger.info('ClawTab popstate event detected, sending snapshot...');
  doSendSnapshot();
});
window.addEventListener('hashchange', () => {
  defaultLogger.info('ClawTab hashchange event detected, sending snapshot...');
  doSendSnapshot();
});

chrome.runtime.onMessage.addListener((message: ContentMessage) => {
  if (message.type === 'url-changed') {
    defaultLogger.info(
      'ClawTab url-changed event detected, sending snapshot...',
      message.url,
    );
    doSendSnapshot();
  }
});

// // 1. 获取 title 节点
// const titleNode = document.querySelector('title');

// // 2. 创建观察者实例
// const cb = (mutationsList) => {
//   for (const mutation of mutationsList) {
//     if (mutation.type === 'childList' || mutation.type === 'characterData') {
//       doSendSnapshot();
//     }
//   }
// };
// const observer = new MutationObserver(cb);

// // 3. 开始监听配置
// observer.observe(titleNode, {
//   childList: true, // 监听子节点的变化（比如文字被替换）
//   characterData: true, // 监听节点内容的变化
//   subtree: true, // 包含后代节点
// });

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
