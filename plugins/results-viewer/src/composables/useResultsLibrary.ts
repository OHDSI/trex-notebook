// Tiny IndexedDB wrapper that stores uploaded Strategus result ZIPs in the
// browser so the user can revisit them without re-uploading.
// localStorage was requested but can't hold blobs of ~1 MB+; IndexedDB is the
// right tool. Metadata (name, size, addedAt) is mirrored in localStorage so
// the list renders synchronously on first paint.

import JSZip from 'jszip'
import { gunzipBuffer } from '../webr/gunzip'

const DB_NAME = 'results-viewer'
const STORE = 'results'
const META_KEY = 'results-viewer:index'
const DB_VERSION = 1

export interface ResultMeta {
  id: string
  name: string
  size: number
  addedAt: number  // epoch ms
}

interface StoredRecord extends ResultMeta {
  blob: Blob
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function readIndex(): ResultMeta[] {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeIndex(items: ResultMeta[]) {
  localStorage.setItem(META_KEY, JSON.stringify(items))
}

export async function listResults(): Promise<ResultMeta[]> {
  // Trust localStorage for the index; rehydrate from IDB if missing.
  const cached = readIndex()
  if (cached.length > 0) return cached.sort((a, b) => b.addedAt - a.addedAt)
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.getAll()
    req.onsuccess = () => {
      const records = req.result as StoredRecord[]
      const metas = records.map(({ id, name, size, addedAt }) => ({ id, name, size, addedAt }))
      writeIndex(metas)
      resolve(metas.sort((a, b) => b.addedAt - a.addedAt))
    }
    req.onerror = () => reject(req.error)
  })
}

export async function addResult(file: File): Promise<ResultMeta> {
  const id = `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const meta: ResultMeta = {
    id,
    name: file.name,
    size: file.size,
    addedAt: Date.now(),
  }
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ ...meta, blob: file })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  const index = readIndex()
  writeIndex([meta, ...index])
  return meta
}

export async function getResultBlob(id: string): Promise<Blob | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => {
      const rec = req.result as StoredRecord | undefined
      resolve(rec ? rec.blob : null)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteResult(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  writeIndex(readIndex().filter(m => m.id !== id))
}

// Load a stored result and unpack it into the file map ShinyFrame expects.
// A binary DuckDB file (optionally gzip'd) passes through as a single
// `results.db` entry; anything else is treated as a ZIP of CSV/parquet exports.
export async function loadResultFiles(
  id: string,
  onProgress?: (msg: string) => void,
): Promise<Map<string, ArrayBuffer>> {
  const blob = await getResultBlob(id)
  if (!blob) throw new Error('Result no longer in storage')
  const arr = await blob.arrayBuffer()
  const name = readIndex().find(m => m.id === id)?.name ?? ''
  if (name.endsWith('.db.gz')) {
    return new Map([['results.db', await gunzipBuffer(arr)]])
  }
  if (name.endsWith('.db')) {
    return new Map([['results.db', arr]])
  }
  const zip = await JSZip.loadAsync(arr)
  const map = new Map<string, ArrayBuffer>()
  const entries = Object.entries(zip.files).filter(([, f]) => !f.dir)
  for (let i = 0; i < entries.length; i++) {
    const [n, f] = entries[i]
    onProgress?.(`Extracting ${i + 1} / ${entries.length}`)
    map.set(n, await f.async('arraybuffer'))
  }
  return map
}

export async function exportResult(id: string): Promise<void> {
  const blob = await getResultBlob(id)
  if (!blob) return
  const meta = readIndex().find(m => m.id === id)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = meta?.name || `${id}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
