/**
 * MV3 Service Worker：接收 content/popup 消息，维护标签页快照、聊天历史与扩展配置。
 */
import { defaultLogger } from '../lib/logger';
import type {
  ContentSnapshotMessage,
  GetChatStateResponse,
  RuntimeMessage,
  SendChatRequest,
  SendChatResponse,
} from '../shared/types';
import { runConnector } from './connector';
import {
  getConfig,
  getHistory,
  resetHistory,
  saveConfig,
  saveHistory,
} from './storage';
import {
  listSnapshots,
  removeSnapshot,
  upsertSnapshot,
} from './tab-content-store';

chrome.runtime.onInstalled.addListener(() => {
  defaultLogger.info('ClawTab installed.');
});

// 异步分支需 return true 并保持 sendResponse 在异步完成后调用，否则通道会提前关闭。
chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, sender, sendResponse) => {
    // 同步应答：页面文本/结构快照
    if (message.type === 'content/snapshot') {
      handleContentSnapshot(message, sender.tab?.id);
      sendResponse({ ok: true });
      return false;
    }

    // 用户消息 → connector → 追加 assistant 回复到历史
    if (message.type === 'chat/send') {
      void handleChat(message).then(sendResponse);
      return true;
    }

    // 拉取聊天与配置
    if (message.type === 'chat/state:get') {
      void handleGetChatState().then(sendResponse);
      return true;
    }

    // 清空历史
    if (message.type === 'chat/state:reset') {
      void handleResetChatState().then(sendResponse);
      return true;
    }

    // 仅配置读
    if (message.type === 'config/get') {
      void handleGetConfig().then(sendResponse);
      return true;
    }
    // 保存配置
    if (message.type === 'config/save') {
      void handleSaveConfig(message.config).then(sendResponse);
      return true;
    }

    return false;
  },
);

// 标签关闭后清理对应快照，避免内存与存储泄漏。
chrome.tabs.onRemoved.addListener((tabId) => {
  removeSnapshot(tabId);
});

/** 来自 content script 的页面快照，按 tabId 写入 tabContentStore。 */
function handleContentSnapshot(
  message: ContentSnapshotMessage,
  tabId?: number,
): void {
  if (typeof tabId !== 'number') {
    return;
  }

  upsertSnapshot({
    tabId,
    ...message.snapshot,
  });
}

/** 用户发消息：拉配置与历史，调用 connector（含当前各 tab 快照），写回对话历史。 */
async function handleChat(message: SendChatRequest): Promise<SendChatResponse> {
  const [config, history] = await Promise.all([getConfig(), getHistory()]);
  const userEntry = {
    id: crypto.randomUUID(),
    role: 'user' as const,
    content: message.message,
  };
  const result = await runConnector(
    message.message,
    listSnapshots(),
    config,
    history,
  );
  const nextHistory = await saveHistory([
    ...history,
    userEntry,
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: result.reply,
    },
  ]);

  return {
    ok: true,
    result,
    history: nextHistory,
  };
}

/** 供 UI 恢复：当前配置 + 完整聊天历史。 */
async function handleGetChatState(): Promise<GetChatStateResponse> {
  const [config, history] = await Promise.all([getConfig(), getHistory()]);
  return {
    ok: true,
    config,
    history,
  };
}

/** 清空聊天历史，配置不变；返回重置后的状态。 */
async function handleResetChatState(): Promise<GetChatStateResponse> {
  const [config, history] = await Promise.all([getConfig(), resetHistory()]);
  return {
    ok: true,
    config,
    history,
  };
}

/** 读取扩展配置（如 API 等）。 */
async function handleGetConfig() {
  return {
    ok: true,
    config: await getConfig(),
  };
}

/** 持久化扩展配置并返回保存结果。 */
async function handleSaveConfig(config: Awaited<ReturnType<typeof getConfig>>) {
  return {
    ok: true,
    config: await saveConfig(config),
  };
}
