import { defaultLogger } from '../lib/logger';
import type { PageSnapshot, TabId } from '../shared/types';

const snapshots = new Map<TabId, PageSnapshot>();

export function upsertSnapshot(snapshot: PageSnapshot): void {
  defaultLogger.info(
    `Upserting snapshot for tabId: ${snapshot.tabId}, title: ${snapshot.title}, url: ${snapshot.url}, updatedAt: ${snapshot.updatedAt}`,
  );
  snapshots.set(snapshot.tabId, snapshot);
}

export function removeSnapshot(tabId: TabId): void {
  snapshots.delete(tabId);
}

export function listSnapshots(): PageSnapshot[] {
  return [...snapshots.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function listTabIds(): TabId[] {
  return [...snapshots.keys()];
}

export function getSnapshot(tabId: TabId): PageSnapshot | undefined {
  return snapshots.get(tabId);
}
