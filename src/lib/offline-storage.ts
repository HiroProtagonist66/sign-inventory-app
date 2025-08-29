import { ProjectSignCatalog, InventoryLogRecord, createInventoryLogRecords } from './supabase'

const DB_NAME = 'SignInventoryDB'
const DB_VERSION = 2  // Increment version for new store
const SIGNS_STORE = 'signs'
const QUEUE_STORE = 'syncQueue'
const ACTIVE_INVENTORY_STORE = 'activeInventory'

interface QueueItem {
  id?: number
  type: 'inventory_records'
  data: Omit<InventoryLogRecord, 'id' | 'created_at'>[]
  timestamp: number
}

export interface ActiveInventorySession {
  id: string  // site_id + area_id combination
  site_id: string
  site_name: string
  area_id?: string
  area_name?: string
  signs: Array<{
    id: string
    sign_number: string
    sign_type_code?: string
    description?: string
    side_a_message?: string
    side_b_message?: string
    status: 'present' | 'missing' | 'damaged' | null
  }>
  lastModified: number
  createdAt: number
}

class OfflineStorage {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    if (this.db) return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(SIGNS_STORE)) {
          const signsStore = db.createObjectStore(SIGNS_STORE, { keyPath: 'id' })
          signsStore.createIndex('site_id', 'site_id', { unique: false })
          signsStore.createIndex('area_id', 'area_id', { unique: false })
        }

        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true })
        }

        if (!db.objectStoreNames.contains(ACTIVE_INVENTORY_STORE)) {
          const activeStore = db.createObjectStore(ACTIVE_INVENTORY_STORE, { keyPath: 'id' })
          activeStore.createIndex('site_id', 'site_id', { unique: false })
          activeStore.createIndex('lastModified', 'lastModified', { unique: false })
        }
      }
    })
  }

  async cacheSignCatalog(siteId: string, areaId: string | undefined, signs: ProjectSignCatalog[]): Promise<void> {
    await this.init()
    if (!this.db) throw new Error('Database not initialized')

    const transaction = this.db.transaction([SIGNS_STORE], 'readwrite')
    const store = transaction.objectStore(SIGNS_STORE)

    const key = `${siteId}`
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({ 
        id: key, 
        siteId, 
        signs, 
        cachedAt: Date.now() 
      })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getCachedSignCatalog(siteId: string): Promise<ProjectSignCatalog[] | null> {
    await this.init()
    if (!this.db) return null

    const key = `${siteId}`
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SIGNS_STORE], 'readonly')
      const store = transaction.objectStore(SIGNS_STORE)
      const request = store.get(key)

      request.onsuccess = () => {
        const result = request.result
        if (result && (Date.now() - result.cachedAt < 24 * 60 * 60 * 1000)) {
          resolve(result.signs)
        } else {
          resolve(null)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  async queueInventoryRecords(records: Omit<InventoryLogRecord, 'id' | 'created_at'>[]): Promise<void> {
    await this.init()
    if (!this.db) throw new Error('Database not initialized')

    const queueItem: QueueItem = {
      type: 'inventory_records',
      data: records,
      timestamp: Date.now()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE], 'readwrite')
      const store = transaction.objectStore(QUEUE_STORE)
      const request = store.add(queueItem)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async syncQueuedRecords(): Promise<void> {
    await this.init()
    if (!this.db) return

    const queuedItems = await this.getQueuedItems()
    
    for (const item of queuedItems) {
      try {
        if (item.type === 'inventory_records') {
          await createInventoryLogRecords(item.data)
          await this.removeQueuedItem(item.id!)
        }
      } catch (error) {
        console.error('Failed to sync queued item:', error)
      }
    }
  }

  private async getQueuedItems(): Promise<QueueItem[]> {
    if (!this.db) return []

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE], 'readonly')
      const store = transaction.objectStore(QUEUE_STORE)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  private async removeQueuedItem(id: number): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE], 'readwrite')
      const store = transaction.objectStore(QUEUE_STORE)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getQueuedRecordsCount(): Promise<number> {
    await this.init()
    if (!this.db) return 0

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE], 'readonly')
      const store = transaction.objectStore(QUEUE_STORE)
      const request = store.count()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async clearCache(): Promise<void> {
    await this.init()
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SIGNS_STORE, QUEUE_STORE], 'readwrite')
      
      const signsStore = transaction.objectStore(SIGNS_STORE)
      const queueStore = transaction.objectStore(QUEUE_STORE)
      
      const clearSigns = signsStore.clear()
      const clearQueue = queueStore.clear()
      
      let completed = 0
      const onComplete = () => {
        completed++
        if (completed === 2) resolve()
      }
      
      clearSigns.onsuccess = onComplete
      clearQueue.onsuccess = onComplete
      clearSigns.onerror = () => reject(clearSigns.error)
      clearQueue.onerror = () => reject(clearQueue.error)
    })
  }

  // Active Inventory Session methods for persistent state
  async saveActiveInventory(session: ActiveInventorySession): Promise<void> {
    await this.init()
    if (!this.db) throw new Error('Database not initialized')

    session.lastModified = Date.now()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ACTIVE_INVENTORY_STORE], 'readwrite')
      const store = transaction.objectStore(ACTIVE_INVENTORY_STORE)
      const request = store.put(session)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getActiveInventory(siteId: string, areaId?: string): Promise<ActiveInventorySession | null> {
    await this.init()
    if (!this.db) return null

    const sessionId = areaId ? `${siteId}_${areaId}` : siteId

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ACTIVE_INVENTORY_STORE], 'readonly')
      const store = transaction.objectStore(ACTIVE_INVENTORY_STORE)
      const request = store.get(sessionId)

      request.onsuccess = () => {
        const result = request.result
        resolve(result || null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getAllActiveInventories(): Promise<ActiveInventorySession[]> {
    await this.init()
    if (!this.db) return []

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ACTIVE_INVENTORY_STORE], 'readonly')
      const store = transaction.objectStore(ACTIVE_INVENTORY_STORE)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  async deleteActiveInventory(siteId: string, areaId?: string): Promise<void> {
    await this.init()
    if (!this.db) return

    const sessionId = areaId ? `${siteId}_${areaId}` : siteId

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ACTIVE_INVENTORY_STORE], 'readwrite')
      const store = transaction.objectStore(ACTIVE_INVENTORY_STORE)
      const request = store.delete(sessionId)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getActiveInventoryCount(): Promise<number> {
    await this.init()
    if (!this.db) return 0

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ACTIVE_INVENTORY_STORE], 'readonly')
      const store = transaction.objectStore(ACTIVE_INVENTORY_STORE)
      const request = store.count()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
}

export const offlineStorage = new OfflineStorage()

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      offlineStorage.syncQueuedRecords().catch(console.error)
    }
    
    const handleOffline = () => setIsOnline(false)

    // Service worker message handler for sync requests
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_OFFLINE_DATA') {
        offlineStorage.syncQueuedRecords().catch(console.error)
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage)

    // Register for background sync when service worker is available
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        // Background sync will be triggered when app goes back online
        const syncManager = (registration as unknown as { sync?: { register: (tag: string) => Promise<void> } }).sync
        if (syncManager) {
          syncManager.register('inventory-sync').catch(console.error)
        }
      })
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage)
    }
  }, [])

  return isOnline
}

import React from 'react'