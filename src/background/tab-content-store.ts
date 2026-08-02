import { defaultLogger } from '../lib/logger';
import type {
  PageSnapshot,
  PageSnapshotBasicInfo,
  TabId,
  TabUrl,
} from '../shared/types';

const snapshots = new Map<TabUrl, PageSnapshot>();
const tabIdToUrlMap = new Map<TabId, TabUrl>();
const urlToTabIdMap = new Map<TabUrl, Set<TabId>>();
const snapshotWaiters = new Map<TabUrl, Set<() => void>>();
const STORAGE_KEY_PREFIX = 'tab-content-store-';
function getStorageKey(url: TabUrl): string {
  return `${STORAGE_KEY_PREFIX}${url}`;
}

/**
 * MV3 的 service worker 空闲约 30 秒即被终止，之后被消息或标签页事件唤醒时
 * onInstalled / onStartup 都不会再触发，模块级的 Map 却已经是空的。
 * 因此所有读取入口都必须先经过这个守卫，把 chrome.storage.local 里的快照
 * 重新灌回内存，否则会出现「storage 里有、内存里没有」的不一致。
 *
 * Promise 本身被缓存，因此并发调用只会真正加载一次；失败时清空缓存以便重试。
 */
let hydration: Promise<void> | undefined;

export function ensureHydrated(): Promise<void> {
  if (!hydration) {
    hydration = loadSnapshotsFromLocalStorage().catch((error) => {
      hydration = undefined;
      throw error;
    });
  }
  return hydration;
}
export async function upsertSnapshot(snapshot: PageSnapshot): Promise<void> {
  defaultLogger.info(
    `Upserting snapshot for title: ${snapshot.title}, url: ${snapshot.url}  , updatedAt: ${snapshot.updatedAt}`,
  );
  // 先补齐内存状态，否则 worker 重启后这次写入会成为唯一的内存记录，
  // 让 listSnapshots 只能看到一条快照。
  await ensureHydrated();
  await chrome.storage.local.set({
    [getStorageKey(snapshot.url)]: snapshot,
  });
  snapshots.set(snapshot.url, snapshot);
  tabIdToUrlMap.set(snapshot.tabId, snapshot.url);
  if (!urlToTabIdMap.has(snapshot.url)) {
    urlToTabIdMap.set(snapshot.url, new Set());
  }
  urlToTabIdMap.get(snapshot.url)?.add(snapshot.tabId);

  const waiters = snapshotWaiters.get(snapshot.url);
  if (waiters && waiters.size > 0) {
    for (const notify of [...waiters]) {
      notify();
    }
  }
}

export async function waitForSnapshot(
  url: TabUrl,
  timeoutMs: number,
): Promise<boolean> {
  // 不先 hydrate 的话，storage 中已有快照的 URL 也会走进等待分支，
  // 白等一个 30 秒超时。
  await ensureHydrated();
  if (snapshots.has(url)) {
    return true;
  }
  return new Promise<boolean>((resolve) => {
    const settle = (ready: boolean) => {
      const current = snapshotWaiters.get(url);
      current?.delete(notify);
      if (current && current.size === 0) {
        snapshotWaiters.delete(url);
      }
      clearTimeout(timer);
      resolve(ready);
    };
    const notify = () => settle(true);
    const timer = setTimeout(() => settle(false), timeoutMs);

    if (!snapshotWaiters.has(url)) {
      snapshotWaiters.set(url, new Set());
    }
    snapshotWaiters.get(url)!.add(notify);
  });
}

export async function removeSnapshot(tabId: TabId): Promise<void> {
  // tabIdToUrlMap 同样是内存态：worker 重启后查不到映射就直接 return，
  // 会把 storage 里的记录永久留成垃圾数据。
  await ensureHydrated();
  const tabUrl = tabIdToUrlMap.get(tabId);
  if (!tabUrl) {
    return;
  }
  tabIdToUrlMap.delete(tabId);
  const tabIds = urlToTabIdMap.get(tabUrl);
  tabIds?.delete(tabId);
  if (!tabIds || tabIds.size === 0) {
    snapshots.delete(tabUrl);
    await chrome.storage.local.remove(getStorageKey(tabUrl));
    urlToTabIdMap.delete(tabUrl);
    return;
  }
}
async function getSnapshotsFromStore(): Promise<PageSnapshot[]> {
  // 单次 get(null) 已经把所有值读了出来，逐 key 再 get 一遍是多余的往返。
  const all = await chrome.storage.local.get(null);
  const result: PageSnapshot[] = [];
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(STORAGE_KEY_PREFIX)) {
      continue;
    }
    const snapshot = value as PageSnapshot | undefined;
    if (snapshot) {
      result.push(snapshot);
    }
  }
  return result;
}
/** 仅供 ensureHydrated 调用；外部一律走 ensureHydrated 以复用同一次加载。 */
async function loadSnapshotsFromLocalStorage(): Promise<void> {
  const storeSnapshots = await getSnapshotsFromStore();
  // 必须查所有窗口：下面的清理逻辑会删掉不在结果里的快照，
  // 若只查当前窗口，其他窗口正常打开的标签页快照会被误删。
  // 这也与 tab.tool.ts 中 chrome.tabs.query({}) 的范围保持一致。
  const tabs = await chrome.tabs.query({});
  const tabsUrlSet = new Set<TabUrl>();
  for (const tab of tabs) {
    // tab.id 在 devtools 等非常规标签页上可能缺失，此时无法建立映射，直接跳过。
    if (!tab.url || tab.id === undefined) {
      continue;
    }
    tabsUrlSet.add(tab.url);
    tabIdToUrlMap.set(tab.id, tab.url);
    let tabIds = urlToTabIdMap.get(tab.url);
    if (!tabIds) {
      tabIds = new Set();
      urlToTabIdMap.set(tab.url, tabIds);
    }
    tabIds.add(tab.id);
  }
  defaultLogger.info('current tabs url set:', tabsUrlSet);
  for (const snapshot of storeSnapshots) {
    if (!tabsUrlSet.has(snapshot.url)) {
      defaultLogger.info(
        `Removing snapshot for title: ${snapshot.title}, url: ${snapshot.url} as the tab is closed`,
      );
      await chrome.storage.local.remove(getStorageKey(snapshot.url));
      continue;
    }
    snapshots.set(snapshot.url, snapshot);
    defaultLogger.info(
      `Loaded snapshot for title: ${snapshot.title}, url: ${snapshot.url} from local storage`,
    );
  }
}
export async function listSnapshots(): Promise<PageSnapshot[]> {
  await ensureHydrated();
  return [...snapshots.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listBasicInfos(): Promise<PageSnapshotBasicInfo[]> {
  await ensureHydrated();
  return [...snapshots.values()].map((snapshot) => ({
    url: snapshot.url,
    title: snapshot.title,
  }));
}

export async function getSnapshot(
  tabUrl: TabUrl,
): Promise<PageSnapshot | undefined> {
  await ensureHydrated();
  return snapshots.get(tabUrl);
}
