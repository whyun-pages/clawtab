/**
 * MV3 Service Worker：接收 content/popup 消息，维护标签页快照、聊天历史与扩展配置。
 */
import { defaultLogger } from '../lib/logger';
import type { UrlChangedMessage } from '../shared/content';
import type {
  ChatStreamClientMessage,
  ChatStreamServerMessage,
  RuntimeMessage,
} from '../shared/types';
import { CHAT_STREAM_PORT } from '../shared/types';
import {
  getRuntimeMessageHandler,
  getStreamMessageHandler,
} from './handlers/factory';
import { ensureHydrated, removeSnapshot } from './tab-content-store';

// 走 ensureHydrated 而非直接调用加载函数：store 的每个读写入口都会自行 hydrate，
// 这里只是把首次加载提前，避免第一个请求为此等待。两者共享同一个 Promise，不会重复加载。
chrome.runtime.onInstalled.addListener(() => {
  defaultLogger.info('ClawTab installed.');
  void ensureHydrated().catch((error) => {
    defaultLogger.error('Failed to load snapshots from local storage.', error);
  });
});
chrome.runtime.onStartup.addListener(() => {
  void ensureHydrated().catch((error) => {
    defaultLogger.error('Failed to load snapshots from local storage.', error);
  });
});

// 点击扩展图标时直接打开侧边栏，不再弹出弹出框。
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => {
    defaultLogger.error('Failed to set side panel behavior.', error);
  });

// 异步分支需 return true 并保持 sendResponse 在异步完成后调用，否则通道会提前关闭。
chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, sender, sendResponse) => {
    const handler = getRuntimeMessageHandler(message);

    if (!handler) {
      return false;
    }

    const result = handler.process(message, { sender });

    if (result instanceof Promise) {
      void result.then(sendResponse);
      return true;
    }

    sendResponse(result);
    return false;
  },
);

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== CHAT_STREAM_PORT) {
    return;
  }

  const abortController = new AbortController();
  let isConnected = true;

  port.onMessage.addListener((message: ChatStreamClientMessage) => {
    const handler = getStreamMessageHandler(message);

    if (!handler) {
      return;
    }

    void handler.process(message, {
      port,
      abortSignal: abortController.signal,
      isConnected: () => isConnected,
      postToPort: (event) => postToPort(port, event),
    });
  });

  port.onDisconnect.addListener(() => {
    isConnected = false;
    abortController.abort();
  });
});

// 标签关闭后清理对应快照，避免内存与存储泄漏。
chrome.tabs.onRemoved.addListener((tabId) => {
  removeSnapshot(tabId).catch((error) => {
    defaultLogger.error(
      `Failed to remove snapshot for tabId: ${tabId} on tab close.`,
      error,
    );
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // 当 URL 发生变化且状态为 loading 或 complete 时
  if (changeInfo.url) {
    const message: UrlChangedMessage = {
      type: 'url-changed',
      url: changeInfo.url,
    };
    chrome.tabs.sendMessage(tabId, message).catch((error) => {
      defaultLogger.debug(
        `Skip url-changed for tabId ${changeInfo.title || ''} [${tabId}]: ${String(error)}`,
      );
    });
  }
});

function postToPort(
  port: chrome.runtime.Port,
  message: ChatStreamServerMessage,
): void {
  try {
    port.postMessage(message);
  } catch (error) {
    if (String(error).includes('disconnected port')) {
      defaultLogger.info(
        'Skip posting stream message because popup port disconnected.',
      );
      return;
    }

    defaultLogger.error('Failed to post stream message to popup.', error);
  }
}
