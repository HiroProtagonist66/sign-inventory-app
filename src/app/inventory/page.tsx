'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  getProjectSignCatalog, 
  createInventorySession, 
  createInventoryLogRecords,
  ProjectSignCatalog, 
  Site, 
  ProjectArea,
  InventoryLogRecord,
  supabase
} from '@/lib/supabase'
import { useOnlineStatus, offlineStorage } from '@/lib/offline-storage'
import { 
  ArrowLeft, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Square, 
  CheckSquare,
  Save
} from 'lucide-react'
import toast from 'react-hot-toast'

type SignStatus = 'present' | 'missing' | 'damaged' | null

interface SignWithStatus extends ProjectSignCatalog {
  status: SignStatus
}

export default function InventoryChecklist() {
  const [signs, setSigns] = useState<SignWithStatus[]>([])
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [selectedArea, setSelectedArea] = useState<ProjectArea | null>(null)
  const [selectedSigns, setSelectedSigns] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [queuedCount, setQueuedCount] = useState(0)
  const [sortBy, setSortBy] = useState<'sign_number' | 'sign_type_code' | 'description'>('sign_number')
  const [signTypes, setSignTypes] = useState<Array<{id: string, code: string, description: string}>>([])
  const [selectedSignType, setSelectedSignType] = useState<string>('all')
  const [filteredSigns, setFilteredSigns] = useState<SignWithStatus[]>([])
  const router = useRouter()
  const isOnline = useOnlineStatus()

  // Extract unique sign types from the loaded signs
  useEffect(() => {
    console.log('useEffect for sign types triggered. Signs length:', signs.length)
    
    if (signs.length > 0) {
      console.log('Extracting sign types from loaded signs...')
      console.log('First few signs:', signs.slice(0, 3))
      
      // Create a map to avoid duplicates and store unique combinations
      const signTypeMap = new Map<string, {id: string, code: string, description: string}>()
      
      signs.forEach(sign => {
        if (sign.sign_type_code && sign.description) {
          const key = `${sign.sign_type_code}-${sign.description}`
          signTypeMap.set(key, {
            id: key,
            code: sign.sign_type_code,
            description: sign.description
          })
        }
      })
      
      const uniqueSignTypes = Array.from(signTypeMap.values())
        .sort((a, b) => a.code.localeCompare(b.code))
      
      console.log('Extracted sign types:', uniqueSignTypes)
      console.log('Sign types count:', uniqueSignTypes.length)
      setSignTypes(uniqueSignTypes)
      
      // Store in sessionStorage for persistence
      if (uniqueSignTypes.length > 0) {
        sessionStorage.setItem('signTypes', JSON.stringify(uniqueSignTypes))
      }
    }
  }, [signs])
  
  // Load sign types from sessionStorage on mount as fallback
  useEffect(() => {
    const storedTypes = sessionStorage.getItem('signTypes')
    if (storedTypes && signTypes.length === 0) {
      const parsed = JSON.parse(storedTypes)
      console.log('Loading sign types from sessionStorage:', parsed.length)
      setSignTypes(parsed)
    }
  }, [])

  // Filter signs when sign type filter changes
  useEffect(() => {
    if (selectedSignType === 'all') {
      setFilteredSigns(signs)
    } else {
      // Find the selected sign type from the ID (which is now code-description)
      const selectedType = signTypes.find(type => type.id === selectedSignType)
      if (selectedType) {
        const filtered = signs.filter(sign => 
          sign.sign_type_code === selectedType.code && 
          sign.description === selectedType.description
        )
        setFilteredSigns(filtered)
      } else {
        setFilteredSigns(signs)
      }
    }
  }, [signs, selectedSignType, signTypes])

  const loadSigns = useCallback(async (siteId: string, areaName?: string, sortBy?: 'sign_number' | 'sign_type_code' | 'description') => {
    try {
      let signsData: ProjectSignCatalog[] = []
      
      if (!isOnline) {
        const cachedSigns = await offlineStorage.getCachedSignCatalog(siteId)
        if (cachedSigns) {
          signsData = cachedSigns
        }
      }
      
      if (signsData.length === 0 && isOnline) {
        signsData = await getProjectSignCatalog(siteId, areaName, sortBy || 'sign_number')
        
        if (signsData && signsData.length > 0) {
          await offlineStorage.cacheSignCatalog(siteId, undefined, signsData)
        }
      }

      const signsWithStatus: SignWithStatus[] = signsData.map(sign => ({
        ...sign,
        status: null
      }))

      console.log('Setting signs in loadSigns. Count:', signsWithStatus.length)
      console.log('Sample sign data:', signsWithStatus[0])
      setSigns(signsWithStatus)
    } catch (error) {
      console.error('Error loading signs:', error)
      toast.error('Failed to load signs')
    } finally {
      setLoading(false)
    }
  }, [isOnline])

  const initializeInventory = useCallback(async () => {
    const siteData = sessionStorage.getItem('selectedSite')
    if (!siteData) {
      router.push('/')
      return
    }

    const site = JSON.parse(siteData)
    setSelectedSite(site)

    const areaData = sessionStorage.getItem('selectedArea')
    const area = areaData ? JSON.parse(areaData) : null
    setSelectedArea(area)

    await loadSigns(site.id, area?.area_name, sortBy)
  }, [router, loadSigns, sortBy])

  useEffect(() => {
    initializeInventory()
    updateQueuedCount()
  }, [initializeInventory])

  useEffect(() => {
    updateQueuedCount()
  }, [])

  // Reload signs when sort order changes
  useEffect(() => {
    if (selectedSite && signs.length > 0) {
      setLoading(true)
      loadSigns(selectedSite.id, selectedArea?.area_name, sortBy)
    }
  }, [sortBy, selectedSite, selectedArea, loadSigns, signs.length])

  async function updateQueuedCount() {
    const count = await offlineStorage.getQueuedRecordsCount()
    setQueuedCount(count)
  }

  function handleBackToAreas() {
    router.push('/areas')
  }

  function toggleSignSelection(signId: string) {
    const newSelected = new Set(selectedSigns)
    if (newSelected.has(signId)) {
      newSelected.delete(signId)
    } else {
      newSelected.add(signId)
    }
    setSelectedSigns(newSelected)
  }

  function selectAllSigns() {
    const allSignIds = new Set(filteredSigns.map(sign => sign.id))
    setSelectedSigns(allSignIds)
  }

  function clearSelection() {
    setSelectedSigns(new Set())
  }

  function updateSignsStatus(status: SignStatus) {
    if (selectedSigns.size === 0) {
      toast.error('Please select signs first')
      return
    }

    const updatedSigns = signs.map(sign => {
      if (selectedSigns.has(sign.id)) {
        return { ...sign, status }
      }
      return sign
    })

    setSigns(updatedSigns)
    setSelectedSigns(new Set())
    
    const statusText = status === 'present' ? 'present' : 
                     status === 'missing' ? 'missing' : 'damaged'
    toast.success(`Marked ${selectedSigns.size} signs as ${statusText}`)
  }

  async function saveInventory() {
    if (!selectedSite) return

    const recordedSigns = signs.filter(sign => sign.status !== null)
    if (recordedSigns.length === 0) {
      toast.error('No signs have been recorded')
      return
    }

    setSaving(true)

    try {
      let sessionId: string

      if (isOnline) {
        const session = await createInventorySession(
          selectedSite.id,
          `Inventory - ${new Date().toLocaleString()}`
        )
        sessionId = session.id
      } else {
        sessionId = `offline-${Date.now()}`
      }

      const records: Omit<InventoryLogRecord, 'id' | 'created_at'>[] = recordedSigns.map(sign => ({
        session_id: sessionId,
        site_id: selectedSite.id,
        inventory_type: sign.status!,
        sign_number: sign.sign_number,
        sign_description_id: sign.sign_description_id,
        quantity: 1,
        notes: undefined
      }))

      if (isOnline) {
        await createInventoryLogRecords(records)
        toast.success('Inventory saved successfully!')
      } else {
        await offlineStorage.queueInventoryRecords(records)
        await updateQueuedCount()
        toast.success('Inventory saved offline. Will sync when connection is restored.')
      }

      setSigns(signs.map(sign => ({ ...sign, status: null })))

    } catch (error) {
      console.error('Error saving inventory:', error)
      toast.error('Failed to save inventory')
    } finally {
      setSaving(false)
    }
  }

  function getStatusColor(status: SignStatus) {
    switch (status) {
      case 'present': return 'text-green-600'
      case 'missing': return 'text-red-600'
      case 'damaged': return 'text-yellow-600'
      default: return 'text-gray-400'
    }
  }

  function getStatusIcon(status: SignStatus) {
    switch (status) {
      case 'present': return <CheckCircle2 className="h-5 w-5" />
      case 'missing': return <XCircle className="h-5 w-5" />
      case 'damaged': return <AlertCircle className="h-5 w-5" />
      default: return <Square className="h-5 w-5" />
    }
  }

  const recordedCount = signs.filter(sign => sign.status !== null).length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToAreas}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Inventory</h1>
                <div className="text-sm text-gray-500">
                  <span>{selectedSite?.name}</span>
                  {selectedArea && <span> • {selectedArea.area_name}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-500" />
              )}
              <span className="text-sm text-gray-500">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
            <span>{filteredSigns.length} filtered signs ({signs.length} total)</span>
            <span>{recordedCount} recorded</span>
          </div>

          {selectedSigns.size > 0 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              <span className="text-sm text-gray-600 flex items-center">
                {selectedSigns.size} selected:
              </span>
              <button
                onClick={() => updateSignsStatus('present')}
                className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm hover:bg-green-200 transition-colors"
              >
                Present
              </button>
              <button
                onClick={() => updateSignsStatus('missing')}
                className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm hover:bg-red-200 transition-colors"
              >
                Missing
              </button>
              <button
                onClick={() => updateSignsStatus('damaged')}
                className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm hover:bg-yellow-200 transition-colors"
              >
                Damaged
              </button>
            </div>
          )}

          <div className="mb-4">
            <div className="flex gap-2 mb-3">
              <button
                onClick={selectAllSigns}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={saveInventory}
                disabled={saving || recordedCount === 0}
                className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'sign_number' | 'sign_type_code' | 'description')}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="sign_number">Sign Number</option>
                  <option value="sign_type_code">Sign Type</option>
                  <option value="description">Description</option>
                </select>
              </div>
              
              {/* Always show filter, even if empty */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Filter by:</span>
                <select
                  value={selectedSignType}
                  onChange={(e) => setSelectedSignType(e.target.value)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={signTypes.length === 0}
                >
                  <option value="all">All Sign Types</option>
                  {signTypes.length === 0 ? (
                    <option value="loading" disabled>Loading...</option>
                  ) : (
                    signTypes.map(signType => (
                      <option key={signType.id} value={signType.id}>
                        {signType.code} - {signType.description}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        {filteredSigns.length === 0 ? (
          <div className="text-center py-12">
            <Square className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Signs Found</h3>
            <p className="text-gray-500">
              {selectedSignType === 'all' ? 'No signs are available for this area.' : 'No signs match the selected filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSigns.map((sign) => (
              <div
                key={sign.id}
                className={`bg-white rounded-lg border p-4 transition-colors ${
                  selectedSigns.has(sign.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleSignSelection(sign.id)}
                    className="mt-1 flex-shrink-0"
                  >
                    {selectedSigns.has(sign.id) ? (
                      <CheckSquare className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">{sign.sign_number}</span>
                        {sign.sign_type_code ? (
                          <span className="text-sm font-medium text-blue-600">{sign.sign_type_code}</span>
                        ) : sign.original_csv_location_plan && (
                          <span className="text-xs text-gray-400">{sign.original_csv_location_plan}</span>
                        )}
                      </div>
                      {sign.description ? (
                        <p className="text-sm text-gray-600">{sign.description}</p>
                      ) : sign.side_a_message && (
                        <p className="text-xs text-gray-400 italic">{sign.side_a_message}</p>
                      )}
                    </div>
                  </div>

                  <div className={`flex-shrink-0 ${getStatusColor(sign.status)}`}>
                    {getStatusIcon(sign.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {queuedCount > 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <Save className="h-5 w-5 text-blue-600 mr-2" />
              <div>
                <h3 className="text-sm font-medium text-blue-800">Queued for Sync</h3>
                <p className="text-sm text-blue-700 mt-1">
                  {queuedCount} inventory record(s) waiting to sync when online.
                </p>
              </div>
            </div>
          </div>
        )}

        {!isOnline && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <WifiOff className="h-5 w-5 text-yellow-600 mr-2" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">Offline Mode</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Inventory data will be saved locally and synced when connection is restored.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}