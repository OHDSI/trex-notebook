// Reader/writer for the results library the results-viewer plugin owns. Both
// plugins run in the same browser origin, so they share this IndexedDB store +
// its localStorage index — a result imported here is visible to the viewer (and
// vice versa). Keep DB_NAME / STORE / META_KEY in sync with the results-viewer's
// composables/useResultsLibrary.ts. Studies only lists / imports / deletes; the
// viewer loads the blob by id, so getResultBlob is intentionally not duplicated.

const DB_NAME = 'results-viewer';
const STORE = 'results';
const META_KEY = 'results-viewer:index';
const DB_VERSION = 1;

export interface ResultMeta {
  id: string;
  name: string;
  size: number;
  addedAt: number; // epoch ms
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readIndex(): ResultMeta[] {
  try {
    const raw = localStorage.getItem(META_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeIndex(items: ResultMeta[]): void {
  localStorage.setItem(META_KEY, JSON.stringify(items));
}

export async function listResults(): Promise<ResultMeta[]> {
  const cached = readIndex();
  if (cached.length > 0) return cached.sort((a, b) => b.addedAt - a.addedAt);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => {
      const metas = (req.result as ResultMeta[]).map(({ id, name, size, addedAt }) => ({
        id,
        name,
        size,
        addedAt,
      }));
      writeIndex(metas);
      resolve(metas.sort((a, b) => b.addedAt - a.addedAt));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function addResult(file: File): Promise<ResultMeta> {
  const id = `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const meta: ResultMeta = { id, name: file.name, size: file.size, addedAt: Date.now() };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ ...meta, blob: file });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  writeIndex([meta, ...readIndex()]);
  return meta;
}

export async function deleteResult(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  writeIndex(readIndex().filter((m) => m.id !== id));
}

export function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
