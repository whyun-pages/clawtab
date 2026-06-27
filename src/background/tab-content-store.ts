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
const STORAGE_KEY_PREFIX = 'tab-content-store-';
function getStorageKey(url: TabUrl): string {
  return `${STORAGE_KEY_PREFIX}${url}`;
}
export async function upsertSnapshot(snapshot: PageSnapshot): Promise<void> {
  defaultLogger.info(
    `Upserting snapshot for title: ${snapshot.title}, url: ${snapshot.url}  , updatedAt: ${snapshot.updatedAt}`,
  );
  snapshots.set(snapshot.url, snapshot);
  await chrome.storage.local.set({
    [getStorageKey(snapshot.url)]: snapshot,
  });
  tabIdToUrlMap.set(snapshot.tabId, snapshot.url);
  if (!urlToTabIdMap.has(snapshot.url)) {
    urlToTabIdMap.set(snapshot.url, new Set());
  }
  urlToTabIdMap.get(snapshot.url)?.add(snapshot.tabId);
}

export async function removeSnapshot(tabId: TabId): Promise<void> {
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
async function getUrlsFromStore(): Promise<TabUrl[]> {
  const all = await chrome.storage.local.get(null);

  return Object.keys(all).filter((key): key is TabUrl =>
    key.startsWith(STORAGE_KEY_PREFIX),
  );
}
async function getSnapshotsFromStore(): Promise<PageSnapshot[]> {
  const keys = await getUrlsFromStore();
  const snapshots: PageSnapshot[] = [];
  await Promise.all(
    keys.map(async (key) => {
      const result = await chrome.storage.local.get(key);
      const snapshot = result[key] as PageSnapshot | undefined;
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }),
  );
  return snapshots;
}
export async function loadSnapshotsFromLocalStorage(): Promise<void> {
  const storeSnapshots = await getSnapshotsFromStore();
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const tabsUrlSet = new Set();
  for (const tab of tabs) {
    if (!tab.url) {
      continue;
    }
    tabsUrlSet.add(tab.url);
    tabIdToUrlMap.set(tab.id!, tab.url);
    if (!urlToTabIdMap.has(tab.url)) {
      urlToTabIdMap.set(tab.url, new Set());
    }
    urlToTabIdMap.get(tab.url)?.add(tab.id!);
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
export function listSnapshots(): PageSnapshot[] {
  return [...snapshots.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function listBasicInfos(): PageSnapshotBasicInfo[] {
  return [...snapshots.values()].map((snapshot) => ({
    url: snapshot.url,
    title: snapshot.title,
  }));
}

export function getSnapshot(tabUrl: TabUrl): PageSnapshot | undefined {
  return snapshots.get(tabUrl);
}
