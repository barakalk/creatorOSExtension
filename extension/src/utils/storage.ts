export interface DomCaptureRecord {
  id: string;
  domHtml: string;
}

export interface DomCaptureMetaRecord {
  id: string;
  url: string;
  timestamp: number;
  sizeBytes: number;
  title?: string;
}

const DB_NAME = 'creator_os_captures';
const DB_VERSION = 1;
const STORE_DATA = 'captures';
const STORE_META = 'metadata';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DATA)) {
        db.createObjectStore(STORE_DATA, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        const meta = db.createObjectStore(STORE_META, { keyPath: 'id' });
        meta.createIndex('timestamp', 'timestamp');
        meta.createIndex('url', 'url');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCaptureToDb(id: string, domHtml: string, meta: DomCaptureMetaRecord): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_DATA, STORE_META], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    (tx.objectStore(STORE_DATA) as IDBObjectStore).put({ id, domHtml } as DomCaptureRecord);
    (tx.objectStore(STORE_META) as IDBObjectStore).put(meta);
  });
}

export async function listCaptures(limit = 100): Promise<DomCaptureMetaRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const index = store.index('timestamp');
    const results: DomCaptureMetaRecord[] = [];
    const cursorReq = index.openCursor(undefined, 'prev');
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value as DomCaptureMetaRecord);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

export async function getCaptureHtml(id: string): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DATA, 'readonly');
    const store = tx.objectStore(STORE_DATA);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result ? (req.result as DomCaptureRecord).domHtml : null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCapture(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_DATA, STORE_META], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_DATA).delete(id);
    tx.objectStore(STORE_META).delete(id);
  });
}
