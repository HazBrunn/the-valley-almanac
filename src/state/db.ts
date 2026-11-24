/**
 * Tiny IndexedDB wrapper for durable profile storage, with a localStorage fallback when
 * IndexedDB is unavailable (some private-browsing modes). All calls are best-effort and
 * never throw into the UI.
 */
import type { Profile } from '../engine/profile';

const DB_NAME = 'valley-almanac';
const DB_VERSION = 1;
const STORE = 'profiles';
const META = 'meta';
const LS_KEY = 'valley-almanac:fallback';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const r = fn(s);
    t.oncomplete = () => resolve(r ? (r.result as T) : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

interface Fallback {
  profiles: Profile[];
  active: string | null;
}

function readFallback(): Fallback {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Fallback) : { profiles: [], active: null };
  } catch {
    return { profiles: [], active: null };
  }
}

function writeFallback(f: Fallback) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(f));
  } catch {
    /* storage full or blocked */
  }
}

export async function loadAll(): Promise<{ profiles: Profile[]; active: string | null; persistent: boolean }> {
  const db = await open();
  if (!db) {
    const f = readFallback();
    return { ...f, persistent: false };
  }
  try {
    const profiles = ((await tx<Profile[]>(db, STORE, 'readonly', (s) => s.getAll())) ?? []) as Profile[];
    const active = ((await tx<string>(db, META, 'readonly', (s) => s.get('active'))) ?? null) as string | null;
    return { profiles, active, persistent: true };
  } catch {
    const f = readFallback();
    return { ...f, persistent: false };
  }
}

export async function saveProfile(p: Profile): Promise<void> {
  const db = await open();
  if (!db) {
    const f = readFallback();
    writeFallback({ ...f, profiles: [...f.profiles.filter((x) => x.id !== p.id), p] });
    return;
  }
  try {
    await tx(db, STORE, 'readwrite', (s) => s.put(p));
  } catch {
    /* ignore */
  }
}

export async function deleteProfile(id: string): Promise<void> {
  const db = await open();
  if (!db) {
    const f = readFallback();
    writeFallback({ ...f, profiles: f.profiles.filter((x) => x.id !== id) });
    return;
  }
  try {
    await tx(db, STORE, 'readwrite', (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}

export async function saveActive(id: string | null): Promise<void> {
  const db = await open();
  if (!db) {
    const f = readFallback();
    writeFallback({ ...f, active: id });
    return;
  }
  try {
    await tx(db, META, 'readwrite', (s) => s.put(id, 'active'));
  } catch {
    /* ignore */
  }
}

/** Ask the browser not to evict our storage (best effort). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}
