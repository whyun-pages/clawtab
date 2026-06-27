import type { Session } from '../shared/types';

import {
  getDb,
  INDEX_SESSIONS_BY_UPDATED_AT,
  STORE_META,
  STORE_SESSIONS,
} from './idb';
import { appendMessages, clearMessages } from './message-store';

const META_CURRENT_SID = 'currentSid';
const DEFAULT_SESSION_TITLE = '新会话';
const WELCOME_MESSAGE_CONTENT =
  '你好，我是 ClawTab。先在设置里填入大模型 Base URL 和 API Key，我就会通过真实的大模型接口来回答你。';

export async function listSessions(): Promise<Session[]> {
  const db = await getDb();
  const sessions = await db.getAllFromIndex(
    STORE_SESSIONS,
    INDEX_SESSIONS_BY_UPDATED_AT,
  );
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createSession(title?: string): Promise<Session> {
  const now = Date.now();
  const session: Session = {
    sid: crypto.randomUUID(),
    title: title?.trim() || DEFAULT_SESSION_TITLE,
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  await db.put(STORE_SESSIONS, session);

  await appendMessages(session.sid, [
    {
      role: 'assistant',
      content: WELCOME_MESSAGE_CONTENT,
    },
  ]);

  return session;
}

export async function renameSession(
  sid: string,
  title: string,
): Promise<Session> {
  const db = await getDb();
  const tx = db.transaction(STORE_SESSIONS, 'readwrite');
  const session = await tx.store.get(sid);
  if (!session) {
    throw new Error(`Session not found: ${sid}`);
  }
  const updated: Session = {
    ...session,
    title: title.trim() || session.title,
    updatedAt: Date.now(),
  };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

export async function deleteSession(
  sid: string,
): Promise<{ nextCurrentSid: string }> {
  await clearMessages(sid);

  const db = await getDb();
  await db.delete(STORE_SESSIONS, sid);

  const currentSid = await readCurrentSid();
  if (currentSid !== sid) {
    return { nextCurrentSid: currentSid ?? (await getCurrentSid()) };
  }

  const remaining = await listSessions();
  if (remaining.length > 0) {
    await writeCurrentSid(remaining[0].sid);
    return { nextCurrentSid: remaining[0].sid };
  }

  const fresh = await createSession();
  await writeCurrentSid(fresh.sid);
  return { nextCurrentSid: fresh.sid };
}

export async function resetSession(sid: string): Promise<void> {
  await clearMessages(sid);
  await appendMessages(sid, [
    {
      role: 'assistant',
      content: WELCOME_MESSAGE_CONTENT,
    },
  ]);
}

export async function getCurrentSid(): Promise<string> {
  const existing = await readCurrentSid();
  if (existing) {
    const db = await getDb();
    const session = await db.get(STORE_SESSIONS, existing);
    if (session) {
      return existing;
    }
  }

  const sessions = await listSessions();
  if (sessions.length > 0) {
    await writeCurrentSid(sessions[0].sid);
    return sessions[0].sid;
  }

  const fresh = await createSession();
  await writeCurrentSid(fresh.sid);
  return fresh.sid;
}

export async function setCurrentSid(sid: string): Promise<void> {
  const db = await getDb();
  const session = await db.get(STORE_SESSIONS, sid);
  if (!session) {
    throw new Error(`Session not found: ${sid}`);
  }
  await writeCurrentSid(sid);
}

async function readCurrentSid(): Promise<string | undefined> {
  const db = await getDb();
  const entry = await db.get(STORE_META, META_CURRENT_SID);
  return entry?.value;
}

async function writeCurrentSid(sid: string): Promise<void> {
  const db = await getDb();
  await db.put(STORE_META, { key: META_CURRENT_SID, value: sid });
}
