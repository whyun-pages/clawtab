import type { PageSnapshot, TabId } from "../shared/types";

const snapshots = new Map<TabId, PageSnapshot>();

export function upsertSnapshot(snapshot: PageSnapshot): void {
  snapshots.set(snapshot.tabId, snapshot);
}

export function removeSnapshot(tabId: TabId): void {
  snapshots.delete(tabId);
}

export function listSnapshots(): PageSnapshot[] {
  return [...snapshots.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}
