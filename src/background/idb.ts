import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { ChatMessage, Session } from '../shared/types';

export const DB_NAME = 'clawtab';
export const DB_VERSION = 1;

export const STORE_SESSIONS = 'sessions';
export const STORE_MESSAGES = 'messages';
export const STORE_META = 'meta';

export const INDEX_SESSIONS_BY_UPDATED_AT = 'by-updatedAt';
export const INDEX_MESSAGES_BY_SID = 'by-sid';
export const INDEX_MESSAGES_BY_SID_SEQ = 'by-sid-seq';

export type MetaEntry = { key: 'currentSid'; value: string };

export interface ClawtabDB extends DBSchema {
  [STORE_SESSIONS]: {
    key: string;
    value: Session;
    indexes: { [INDEX_SESSIONS_BY_UPDATED_AT]: number };
  };
  [STORE_MESSAGES]: {
    key: string;
    value: ChatMessage;
    indexes: {
      [INDEX_MESSAGES_BY_SID]: string;
      [INDEX_MESSAGES_BY_SID_SEQ]: [string, number];
    };
  };
  [STORE_META]: {
    key: string;
    value: MetaEntry;
  };
}

let dbPromise: Promise<IDBPDatabase<ClawtabDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<ClawtabDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ClawtabDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          const sessions = db.createObjectStore(STORE_SESSIONS, {
            keyPath: 'sid',
          });
          sessions.createIndex(INDEX_SESSIONS_BY_UPDATED_AT, 'updatedAt');
        }
        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          const messages = db.createObjectStore(STORE_MESSAGES, {
            keyPath: 'cid',
          });
          messages.createIndex(INDEX_MESSAGES_BY_SID, 'sid');
          messages.createIndex(INDEX_MESSAGES_BY_SID_SEQ, ['sid', 'seq']);
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}
