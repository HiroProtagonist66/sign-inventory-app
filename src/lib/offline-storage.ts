import { ProjectSignCatalog, InventoryLogRecord, createInventoryLogRecords, Site, ProjectArea } from './supabase'

const DB_NAME = 'SignInventoryDB'
const DB_VERSION = 4  // Increment version to force migration
const SIGNS_STORE = 'signs'
const QUEUE_STORE = 'syncQueue'
const ACTIVE_INVENTORY_STORE = 'activeInventory'
const AREAS_STORE = 'areas'
const SITES_STORE = 'sites'

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
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onerror = () => {
          console.error('IndexedDB error:', request.error)
          // If there's a version error, try to delete and recreate
          if (request.error?.name === 'VersionError') {
            this.deleteAndRecreateDB().then(resolve).catch(reject)
          } else {
            reject(request.error)
          }
        }
        
        request.onsuccess = () => {
          this.db = request.result
          resolve()
        }

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          const oldVersion = event.oldVersion
          
          console.log(`Upgrading IndexedDB from version ${oldVersion} to ${DB_VERSION}`)

          // Delete old stores if they exist with wrong structure
          if (oldVersion < 4 && db.objectStoreNames.contains(SIGNS_STORE)) {
            db.deleteObjectStore(SIGNS_STORE)
          }

          if (!db.objectStoreNames.contains(SIGNS_STORE)) {
            const signsStore = db.createObjectStore(SIGNS_STORE, { keyPath: 'id' })
            signsStore.createIndex('site_id', 'siteId', { unique: false })
            signsStore.createIndex('area_id', 'areaId', { unique: false })
          }

          if (!db.objectStoreNames.contains(QUEUE_STORE)) {
            db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true })
          }

          if (!db.objectStoreNames.contains(ACTIVE_INVENTORY_STORE)) {
            const activeStore = db.createObjectStore(ACTIVE_INVENTORY_STORE, { keyPath: 'id' })
            activeStore.createIndex('site_id', 'site_id', { unique: false })
            activeStore.createIndex('lastModified', 'lastModified', { unique: false })
          }

          if (!db.objectStoreNames.contains(AREAS_STORE)) {
            const areasStore = db.createObjectStore(AREAS_STORE, { keyPath: 'id' })
            areasStore.createIndex('site_id', 'site_id', { unique: false })
          }

          if (!db.objectStoreNames.contains(SITES_STORE)) {
            db.createObjectStore(SITES_STORE, { keyPath: 'id' })
          }
        }
      } catch (error) {
        console.error('Failed to initialize IndexedDB:', error)
        reject(error)
      }
    })
  }

  async deleteAndRecreateDB(): Promise<void> {
    console.log('Deleting and recreating IndexedDB due to version mismatch')
    
    // Close existing connection
    if (this.db) {
      this.db.close()
      this.db = null
    }
    
    // Delete the database
    await new Promise<void>((resolve, reject) => {
      const deleteReq = indexedDB.deleteDatabase(DB_NAME)
      deleteReq.onsuccess = () => resolve()
      deleteReq.onerror = () => reject(deleteReq.error)
    })
    
    // Reinitialize
    await this.init()
  }

  async cacheSignCatalog(siteId: string, areaId: string | undefined, signs: ProjectSignCatalog[]): Promise<void> {
    await this.init()
    if (!this.db) throw new Error('Database not initialized')

    const transaction = this.db.transaction([SIGNS_STORE], 'readwrite')
    const store = transaction.objectStore(SIGNS_STORE)

    // Use a composite key that includes both site and area
    const key = areaId ? `${siteId}_${areaId}` : `${siteId}_ALL`
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({ 
        id: key, 
        siteId,
        areaId: areaId || 'ALL',
        signs, 
        cachedAt: Date.now() 
      })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getCachedSignCatalog(siteId: string, areaId?: string): Promise<ProjectSignCatalog[] | null> {
    await this.init()
    if (!this.db) return null

    // Use a composite key that includes both site and area
    const key = areaId ? `${siteId}_${areaId}` : `${siteId}_ALL`
    
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

  // Cache site data for offline access
  async cacheSite(site: Site & { site_name?: string }): Promise<void> {
    await this.init()
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SITES_STORE], 'readwrite')
      const store = transaction.objectStore(SITES_STORE)
      const request = store.put({
        ...site,
        cachedAt: Date.now()
      })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getCachedSites(): Promise<Site[]> {
    await this.init()
    if (!this.db) return []

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SITES_STORE], 'readonly')
      const store = transaction.objectStore(SITES_STORE)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  // Cache areas for a site
  async cacheAreas(siteId: string, areas: ProjectArea[]): Promise<void> {
    await this.init()
    if (!this.db) throw new Error('Database not initialized')

    const transaction = this.db.transaction([AREAS_STORE], 'readwrite')
    const store = transaction.objectStore(AREAS_STORE)

    const promises = areas.map(area => new Promise<void>((resolve, reject) => {
      const request = store.put({
        ...area,
        site_id: siteId,
        cachedAt: Date.now()
      })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    }))

    await Promise.all(promises)
  }

  async getCachedAreas(siteId: string): Promise<ProjectArea[]> {
    await this.init()
    if (!this.db) return []

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([AREAS_STORE], 'readonly')
      const store = transaction.objectStore(AREAS_STORE)
      const index = store.index('site_id')
      const request = index.getAll(siteId)

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  // Download complete area data for offline use
  async downloadAreaForOffline(siteId: string, siteName: string, areaId: string, areaName: string, signs: ProjectSignCatalog[]): Promise<void> {
    await this.init()
    
    // Cache the site with proper type
    const siteData: Site & { site_name?: string } = {
      id: siteId,
      name: siteName,
      created_at: new Date().toISOString(),
      site_name: siteName
    }
    await this.cacheSite(siteData)
    
    // Cache the area with proper type
    const areaData: ProjectArea = {
      id: areaId,
      area_name: areaName,
      site_id: siteId,
      created_at: new Date().toISOString()
    }
    await this.cacheAreas(siteId, [areaData])
    
    // Cache the signs
    await this.cacheSignCatalog(siteId, areaId, signs)
    
    console.log(`Downloaded ${areaName} for offline use with ${signs.length} signs`)
  }

  // Check if area is downloaded for offline
  async isAreaDownloaded(siteId: string, areaId?: string): Promise<boolean> {
    await this.init()
    if (!this.db) return false
    
    const cachedSigns = await this.getCachedSignCatalog(siteId, areaId)
    
    return cachedSigns !== null && cachedSigns.length > 0
  }

  // Get list of downloaded areas for a site
  async getDownloadedAreas(siteId: string): Promise<string[]> {
    await this.init()
    if (!this.db) return []

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([SIGNS_STORE], 'readonly')
        const store = transaction.objectStore(SIGNS_STORE)
        const request = store.getAll()

        request.onsuccess = () => {
          const results = request.result || []
          // Filter by siteId and extract area IDs
          const areaIds = results
            .filter(r => r.siteId === siteId && r.areaId && r.areaId !== 'ALL')
            .map(r => r.areaId)
          resolve(areaIds)
        }
        request.onerror = () => {
          console.error('Error getting downloaded areas:', request.error)
          resolve([]) // Return empty array on error
        }
      } catch (error) {
        console.error('Error in getDownloadedAreas:', error)
        resolve([]) // Return empty array on error
      }
    })
  }
}

export const offlineStorage = new OfflineStorage()

// Utility function to reset IndexedDB if needed
export async function resetIndexedDB(): Promise<void> {
  console.log('Resetting IndexedDB...')
  const instance = offlineStorage as any
  if (instance.db) {
    instance.db.close()
    instance.db = null
  }
  
  await new Promise<void>((resolve, reject) => {
    const deleteReq = indexedDB.deleteDatabase(DB_NAME)
    deleteReq.onsuccess = () => {
      console.log('IndexedDB reset successfully')
      resolve()
    }
    deleteReq.onerror = () => {
      console.error('Failed to reset IndexedDB:', deleteReq.error)
      reject(deleteReq.error)
    }
  })
}

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