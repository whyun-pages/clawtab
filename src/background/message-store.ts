import type { ChatMessage } from '../shared/types';

import {
  getDb,
  INDEX_MESSAGES_BY_SID,
  INDEX_MESSAGES_BY_SID_SEQ,
  STORE_MESSAGES,
  STORE_SESSIONS,
} from './idb';

export type NewMessageInput = Omit<
  ChatMessage,
  'cid' | 'sid' | 'seq' | 'createdAt'
> &
  Partial<Pick<ChatMessage, 'cid'>>;

export async function getMessages(sid: string): Promise<ChatMessage[]> {
  const db = await getDb();
  const range = IDBKeyRange.bound([sid, -Infinity], [sid, Infinity]);
  return db.getAllFromIndex(STORE_MESSAGES, INDEX_MESSAGES_BY_SID_SEQ, range);
}

export async function appendMessages(
  sid: string,
  inputs: NewMessageInput[],
): Promise<ChatMessage[]> {
  if (inputs.length === 0) {
    return getMessages(sid);
  }

  const db = await getDb();
  const tx = db.transaction([STORE_MESSAGES, STORE_SESSIONS], 'readwrite');
  const messages = tx.objectStore(STORE_MESSAGES);
  const sessions = tx.objectStore(STORE_SESSIONS);

  const session = await sessions.get(sid);
  if (!session) {
    throw new Error(`Session not found: ${sid}`);
  }

  const lastKey = await messages
    .index(INDEX_MESSAGES_BY_SID_SEQ)
    .openCursor(IDBKeyRange.bound([sid, -Infinity], [sid, Infinity]), 'prev');
  let nextSeq = lastKey ? lastKey.value.seq + 1 : 0;

  const now = Date.now();
  for (const input of inputs) {
    const record: ChatMessage = {
      cid: input.cid ?? crypto.randomUUID(),
      sid,
      role: input.role,
      content: input.content,
      ...(input.contentKey !== undefined
        ? { contentKey: input.contentKey }
        : {}),
      ...(input.reasoning !== undefined ? { reasoning: input.reasoning } : {}),
      ...(input.toolCalls !== undefined ? { toolCalls: input.toolCalls } : {}),
      createdAt: now,
      seq: nextSeq,
    };
    await messages.put(record);
    nextSeq += 1;
  }

  await sessions.put({ ...session, updatedAt: now });
  await tx.done;

  return getMessages(sid);
}

export async function clearMessages(sid: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_MESSAGES, 'readwrite');
  const range = IDBKeyRange.only(sid);
  const index = tx.store.index(INDEX_MESSAGES_BY_SID);
  let cursor = await index.openCursor(range);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}
