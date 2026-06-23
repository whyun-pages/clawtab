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

export function upsertSnapshot(snapshot: PageSnapshot): void {
  defaultLogger.info(
    `Upserting snapshot for title: ${snapshot.title}, url: ${snapshot.url}, updatedAt: ${snapshot.updatedAt}`,
  );
  snapshots.set(snapshot.url, snapshot);
  tabIdToUrlMap.set(snapshot.tabId, snapshot.url);
  if (!urlToTabIdMap.has(snapshot.url)) {
    urlToTabIdMap.set(snapshot.url, new Set());
  }
  urlToTabIdMap.get(snapshot.url)?.add(snapshot.tabId);
}

export function removeSnapshot(tabId: TabId): void {
  const tabUrl = tabIdToUrlMap.get(tabId);
  if (!tabUrl) {
    return;
  }
  tabIdToUrlMap.delete(tabId);
  const tabIds = urlToTabIdMap.get(tabUrl);
  tabIds?.delete(tabId);
  if (!tabIds || tabIds.size === 0) {
    snapshots.delete(tabUrl);
    urlToTabIdMap.delete(tabUrl);
    return;
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
