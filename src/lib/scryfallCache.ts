/**
 * Scryfall API response cache using IndexedDB.
 * Per Scryfall docs: cache data for at least 24 hours.
 * @see https://scryfall.com/docs/api
 * @see https://scryfall.com/docs/api/bulk-data
 */

const DB_NAME = 'deck-tutor-scryfall'
const DB_VERSION = 1
const STORE_NAME = 'api-cache'
const BULK_STORE_NAME = 'bulk-data'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface CacheEntry<T> {
  key: string
  data: T
  cachedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(BULK_STORE_NAME)) {
        db.createObjectStore(BULK_STORE_NAME, { keyPath: 'key' })
      }
    }
  })
}

function getStore(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode = 'readonly'
): IDBObjectStore {
  return db.transaction(storeName, mode).objectStore(storeName)
}

export async function getCached<T>(key: string): Promise<T | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORE_NAME)
    const request = store.get(key)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const entry = request.result as CacheEntry<T> | undefined
      if (!entry) {
        resolve(null)
        return
      }
      const age = Date.now() - entry.cachedAt
      if (age > CACHE_TTL_MS) {
        resolve(null)
        return
      }
      resolve(entry.data)
    }
  })
}

export async function setCached<T>(key: string, data: T): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORE_NAME, 'readwrite')
    const entry: CacheEntry<T> = {
      key,
      data,
      cachedAt: Date.now(),
    }
    const request = store.put(entry)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/** Cache key for search results */
export function searchCacheKey(query: string, page = 1): string {
  return `search:${query}:${page}`
}

/** Cache key for named card lookup */
export function namedCacheKey(name: string, exact: boolean): string {
  return `named:${exact ? 'exact' : 'fuzzy'}:${name.toLowerCase()}`
}

/** Cache key for autocomplete */
export function autocompleteCacheKey(query: string): string {
  return `autocomplete:${query.toLowerCase()}`
}

/** Cache key for bulk data by type */
export function bulkCacheKey(type: string): string {
  return `bulk:${type}`
}

/** Get cached bulk data (no TTL - bulk data is updated daily, we rely on manual refresh) */
export async function getBulkCached<T>(type: string): Promise<T | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = getStore(db, BULK_STORE_NAME)
    const request = store.get(bulkCacheKey(type))
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const entry = request.result as CacheEntry<T> | undefined
      resolve(entry?.data ?? null)
    }
  })
}

/** Set cached bulk data */
export async function setBulkCached<T>(type: string, data: T): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = getStore(db, BULK_STORE_NAME, 'readwrite')
    const entry: CacheEntry<T> = {
      key: bulkCacheKey(type),
      data,
      cachedAt: Date.now(),
    }
    const request = store.put(entry)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}
