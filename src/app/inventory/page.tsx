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
import { useOnlineStatus, offlineStorage, ActiveInventorySession } from '@/lib/offline-storage'
import { 
  ArrowLeft, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Square, 
  CheckSquare,
  Save,
  Search,
  X
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
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showConnectionAlert, setShowConnectionAlert] = useState(false)
  const [lastConnectionStatus, setLastConnectionStatus] = useState<boolean | null>(null)
  const router = useRouter()
  const isOnline = useOnlineStatus()

  // Monitor connection status changes
  useEffect(() => {
    if (lastConnectionStatus !== null && lastConnectionStatus !== isOnline) {
      setShowConnectionAlert(true)
      
      if (isOnline) {
        toast.success('Back online! Your changes will be synced.', {
          duration: 4000,
          icon: '🌐'
        })
      } else {
        toast.error('You are now offline. Changes will be saved locally.', {
          duration: 4000,
          icon: '📡'
        })
      }
      
      // Hide alert after 5 seconds
      const timer = setTimeout(() => {
        setShowConnectionAlert(false)
      }, 5000)
      
      return () => clearTimeout(timer)
    }
    setLastConnectionStatus(isOnline)
  }, [isOnline, lastConnectionStatus])

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

  // Filter signs when sign type filter or search query changes
  useEffect(() => {
    let filtered = signs
    
    // Apply sign type filter
    if (selectedSignType !== 'all') {
      const selectedType = signTypes.find(type => type.id === selectedSignType)
      if (selectedType) {
        filtered = filtered.filter(sign => 
          sign.sign_type_code === selectedType.code && 
          sign.description === selectedType.description
        )
      }
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(sign => {
        return sign.sign_number?.toLowerCase().includes(query) ||
               sign.sign_type_code?.toLowerCase().includes(query) ||
               sign.description?.toLowerCase().includes(query) ||
               sign.side_a_message?.toLowerCase().includes(query) ||
               sign.side_b_message?.toLowerCase().includes(query)
      })
    }
    
    setFilteredSigns(filtered)
  }, [signs, selectedSignType, signTypes, searchQuery])

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

  // Save current inventory state to IndexedDB
  const saveInventoryToIndexedDB = useCallback(async (updatedSigns: SignWithStatus[]) => {
    if (!selectedSite) return
    
    const sessionId = selectedArea 
      ? `${selectedSite.id}_${selectedArea.id}` 
      : selectedSite.id
    
    const session: ActiveInventorySession = {
      id: sessionId,
      site_id: selectedSite.id,
      site_name: (selectedSite as any).site_name || selectedSite.id,
      area_id: selectedArea?.id,
      area_name: selectedArea?.area_name,
      signs: updatedSigns.map(sign => ({
        id: sign.id,
        sign_number: sign.sign_number,
        sign_type_code: sign.sign_type_code,
        description: sign.description,
        side_a_message: sign.side_a_message,
        side_b_message: sign.side_b_message,
        status: sign.status
      })),
      lastModified: Date.now(),
      createdAt: Date.now()
    }
    
    try {
      await offlineStorage.saveActiveInventory(session)
      console.log('Inventory saved to IndexedDB')
    } catch (error) {
      console.error('Failed to save inventory to IndexedDB:', error)
    }
  }, [selectedSite, selectedArea])

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

    // Check for saved inventory session in IndexedDB
    const sessionId = area ? `${site.id}_${area.id}` : site.id
    const savedSession = await offlineStorage.getActiveInventory(site.id, area?.id)
    
    if (savedSession && savedSession.signs.length > 0) {
      // Restore saved inventory with status
      const restoredSigns: SignWithStatus[] = savedSession.signs.map(sign => ({
        id: sign.id,
        sign_number: sign.sign_number,
        sign_type_code: sign.sign_type_code || undefined,
        description: sign.description || undefined,
        side_a_message: sign.side_a_message || undefined,
        side_b_message: sign.side_b_message || undefined,
        status: sign.status,
        site_id: site.id,
        original_csv_level_no: undefined,
        original_csv_location_plan: undefined,
        original_csv_location_description: undefined,
        sign_description_id: undefined,
        original_project_area: undefined,
        location_updated: undefined,
        row_number: undefined,
        created_at: new Date().toISOString()
      }))
      
      setSigns(restoredSigns)
      toast.success('Restored unsaved inventory from previous session', { 
        duration: 4000,
        icon: '💾'
      })
      setLoading(false)
    } else {
      // Load fresh from database
      await loadSigns(site.id, area?.area_name, 'sign_number')
    }
  }, [router, loadSigns])

  useEffect(() => {
    initializeInventory()
    updateQueuedCount()
  }, [initializeInventory])

  useEffect(() => {
    updateQueuedCount()
  }, [])

  // Sort signs when sort order changes (without reloading from database)
  useEffect(() => {
    if (signs.length > 0) {
      const sortedSigns = [...signs].sort((a, b) => {
        switch (sortBy) {
          case 'sign_number':
            return (a.sign_number || '').localeCompare(b.sign_number || '')
          case 'sign_type_code':
            return (a.sign_type_code || '').localeCompare(b.sign_type_code || '')
          case 'description':
            return (a.description || '').localeCompare(b.description || '')
          default:
            return 0
        }
      })
      setSigns(sortedSigns)
    }
  }, [sortBy])

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

  function selectSignsByStatus(status: SignStatus) {
    const signsByStatus = filteredSigns
      .filter(sign => sign.status === status)
      .map(sign => sign.id)
    setSelectedSigns(new Set(signsByStatus))
    
    if (signsByStatus.length === 0) {
      toast.error(`No ${status || 'unrecorded'} signs found`)
    } else {
      toast.success(`Selected ${signsByStatus.length} ${status || 'unrecorded'} signs`)
    }
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
    
    // Auto-save to IndexedDB
    saveInventoryToIndexedDB(updatedSigns)
    
    const statusText = status === 'present' ? 'present' : 
                     status === 'missing' ? 'missing' : 'damaged'
    toast.success(`Marked ${selectedSigns.size} signs as ${statusText}`)
  }

  function updateSingleSignStatus(signId: string, status: SignStatus) {
    const updatedSigns = signs.map(sign => {
      if (sign.id === signId) {
        return { ...sign, status }
      }
      return sign
    })
    
    setSigns(updatedSigns)
    
    // Auto-save to IndexedDB
    saveInventoryToIndexedDB(updatedSigns)
    
    const statusText = status === 'present' ? 'Present' : 
                     status === 'missing' ? 'Missing' : 
                     status === 'damaged' ? 'Damaged' : 'Unrecorded'
    const sign = signs.find(s => s.id === signId)
    if (sign) {
      toast.success(`${sign.sign_number}: ${statusText}`, { duration: 2000 })
    }
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

      // Clear the saved session from IndexedDB after successful save
      await offlineStorage.deleteActiveInventory(selectedSite.id, selectedArea?.id)
      
      setSigns(signs.map(sign => ({ ...sign, status: null })))

    } catch (error) {
      console.error('Error saving inventory:', error)
      toast.error('Failed to save inventory')
    } finally {
      setSaving(false)
    }
  }

  function getCardBackgroundColor(status: SignStatus, isSelected: boolean) {
    if (isSelected) {
      return 'border-blue-300 bg-blue-50'
    }
    
    switch (status) {
      case 'present': return 'border-green-300 bg-green-50'
      case 'missing': return 'border-red-300 bg-red-50'
      case 'damaged': return 'border-yellow-300 bg-yellow-50'
      default: return 'border-gray-200 bg-white'
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
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
              isOnline 
                ? 'bg-green-100 border border-green-300' 
                : 'bg-red-100 border border-red-300 animate-pulse'
            }`}>
              {isOnline ? (
                <>
                  <Wifi className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700">Offline</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
            <span>{filteredSigns.length} filtered signs ({signs.length} total)</span>
            <span>{recordedCount} recorded</span>
          </div>

          {/* Unsaved changes indicator */}
          {recordedCount > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">
                  {recordedCount} unsaved {recordedCount === 1 ? 'change' : 'changes'} (auto-saved locally)
                </span>
              </div>
              <button
                onClick={saveInventory}
                disabled={saving}
                className="px-3 py-1 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Now'}
              </button>
            </div>
          )}

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
              <div className="flex-1 relative">
                <select
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === 'all') selectAllSigns()
                    else if (value === 'clear') clearSelection()
                    else if (value === 'present') selectSignsByStatus('present')
                    else if (value === 'missing') selectSignsByStatus('missing')
                    else if (value === 'damaged') selectSignsByStatus('damaged')
                    else if (value === 'unrecorded') selectSignsByStatus(null)
                    e.target.value = 'select' // Reset dropdown
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors appearance-none cursor-pointer"
                  defaultValue="select"
                >
                  <option value="select" disabled>Select...</option>
                  <option value="all">Select All</option>
                  <option value="clear">Clear Selection</option>
                  <option value="present">Select Present</option>
                  <option value="missing">Select Missing</option>
                  <option value="damaged">Select Damaged</option>
                  <option value="unrecorded">Select Unrecorded</option>
                </select>
              </div>
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
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search signs..."
                  className="w-full pl-10 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                  >
                    <X className="h-3 w-3 text-gray-500" />
                  </button>
                )}
              </div>

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
                <span className="text-sm text-gray-600">Filter:</span>
                <select
                  value={selectedSignType}
                  onChange={(e) => setSelectedSignType(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 truncate"
                  disabled={signTypes.length === 0}
                >
                  <option value="all">All Sign Types</option>
                  {signTypes.length === 0 ? (
                    <option value="loading" disabled>Loading...</option>
                  ) : (
                    signTypes.map(signType => {
                      // Truncate long descriptions for mobile
                      const desc = signType.description.length > 20 
                        ? signType.description.substring(0, 20) + '...' 
                        : signType.description
                      return (
                        <option key={signType.id} value={signType.id}>
                          {signType.code} - {desc}
                        </option>
                      )
                    })
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
                className={`rounded-lg border p-4 transition-colors ${getCardBackgroundColor(sign.status, selectedSigns.has(sign.id))}`}
              >
                <div className="flex items-start gap-3">
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
                    
                    {/* Quick status toggle buttons */}
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={() => updateSingleSignStatus(sign.id, 'present')}
                        className={`px-2 py-1 text-xs rounded-full transition-colors ${
                          sign.status === 'present' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700'
                        }`}
                      >
                        <CheckCircle2 className="h-3 w-3 inline mr-1" />
                        Present
                      </button>
                      <button
                        onClick={() => updateSingleSignStatus(sign.id, 'missing')}
                        className={`px-2 py-1 text-xs rounded-full transition-colors ${
                          sign.status === 'missing' 
                            ? 'bg-red-600 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700'
                        }`}
                      >
                        <XCircle className="h-3 w-3 inline mr-1" />
                        Missing
                      </button>
                      <button
                        onClick={() => updateSingleSignStatus(sign.id, 'damaged')}
                        className={`px-2 py-1 text-xs rounded-full transition-colors ${
                          sign.status === 'damaged' 
                            ? 'bg-yellow-600 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-yellow-100 hover:text-yellow-700'
                        }`}
                      >
                        <AlertCircle className="h-3 w-3 inline mr-1" />
                        Damaged
                      </button>
                    </div>
                  </div>

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