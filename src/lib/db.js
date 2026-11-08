/**
 * Lightweight IndexedDB wrapper (promise-based)
 * Stores: workouts, plans, evaluations, timerTemplates, completedSessions
 */

const DB_NAME = 'runlab-db'
const DB_VERSION = 1

const STORES = [
  'workouts',
  'plans',
  'evaluations',
  'timerTemplates',
  'completedSessions'
]

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      STORES.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' })
          if (name === 'evaluations') store.createIndex('createdAt', 'createdAt')
          if (name === 'completedSessions') store.createIndex('date', 'date')
        }
      })
    }
  })
  return dbPromise
}

export async function getAll(storeName) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

export async function getById(storeName, id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).get(id)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function put(storeName, item) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const req = tx.objectStore(storeName).put(item)
    req.onsuccess = () => resolve(item)
    req.onerror = () => reject(req.error)
  })
}

export async function remove(storeName, id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const req = tx.objectStore(storeName).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function clearStore(storeName) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const req = tx.objectStore(storeName).clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function exportAll() {
  const data = {}
  for (const store of STORES) {
    data[store] = await getAll(store)
  }
  data.exportedAt = new Date().toISOString()
  data.version = 1
  return data
}

export async function importAll(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid data')
  for (const store of STORES) {
    if (Array.isArray(data[store])) {
      await clearStore(store)
      for (const item of data[store]) {
        await put(store, item)
      }
    }
  }
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}
