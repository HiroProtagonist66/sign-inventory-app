'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getProjectAreas, getProjectSignCatalog, ProjectArea, Site } from '@/lib/supabase'
import { useOnlineStatus, offlineStorage } from '@/lib/offline-storage'
import { ArrowLeft, MapPin, Wifi, WifiOff, Building2, Download, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AreaSelection() {
  const [areas, setAreas] = useState<ProjectArea[]>([])
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloadedAreas, setDownloadedAreas] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState<string | null>(null)
  const [allAreasDownloaded, setAllAreasDownloaded] = useState(false)
  const router = useRouter()
  const isOnline = useOnlineStatus()

  useEffect(() => {
    const siteData = sessionStorage.getItem('selectedSite')
    if (!siteData) {
      router.push('/')
      return
    }
    
    const site = JSON.parse(siteData)
    setSelectedSite(site)
    loadAreas(site.id)
  }, [router, isOnline]) // Re-run when online status changes

  async function loadAreas(siteId: string) {
    try {
      let data: ProjectArea[] = []
      
      // Try to load from cache first if offline
      if (!isOnline) {
        const cachedAreas = await offlineStorage.getCachedAreas(siteId)
        if (cachedAreas.length > 0) {
          // When offline, only show areas that have been downloaded
          const downloadedAreasList: ProjectArea[] = []
          for (const area of cachedAreas) {
            const isDownloaded = await offlineStorage.isAreaDownloaded(siteId, area.id)
            if (isDownloaded) {
              downloadedAreasList.push(area)
            }
          }
          
          if (downloadedAreasList.length > 0) {
            data = downloadedAreasList
            toast.success(`Loading ${downloadedAreasList.length} downloaded area${downloadedAreasList.length > 1 ? 's' : ''} from offline cache`)
          } else {
            toast.error('No offline areas available. Please download areas when online.')
          }
        } else {
          toast.error('No offline data available. Please download areas when online.')
        }
      } else {
        // Online - fetch fresh data
        data = await getProjectAreas(siteId)
        // Cache for future offline use
        if (data.length > 0) {
          await offlineStorage.cacheAreas(siteId, data)
        }
      }
      
      setAreas(data)
      
      // Check which areas are already downloaded
      const downloaded = new Set<string>()
      for (const area of data) {
        const isDownloaded = await offlineStorage.isAreaDownloaded(siteId, area.id)
        if (isDownloaded) {
          downloaded.add(area.id)
        }
      }
      setDownloadedAreas(downloaded)
      
      // Check if "All Areas" is downloaded
      const allDownloaded = await offlineStorage.isAreaDownloaded(siteId, undefined)
      setAllAreasDownloaded(allDownloaded)
    } catch (error) {
      console.error('Error loading areas:', error)
      toast.error('Failed to load areas')
    } finally {
      setLoading(false)
    }
  }
  
  async function downloadAreaForOffline(area: ProjectArea) {
    if (!selectedSite || !isOnline) return
    
    setDownloading(area.id)
    try {
      // Fetch all signs for this area
      const signs = await getProjectSignCatalog(selectedSite.id, area.area_name)
      
      // Download and cache everything
      await offlineStorage.downloadAreaForOffline(
        selectedSite.id,
        selectedSite.name || selectedSite.id,
        area.id,
        area.area_name,
        signs
      )
      
      setDownloadedAreas(prev => new Set([...prev, area.id]))
      toast.success(`Downloaded ${area.area_name} for offline use (${signs.length} signs)`)
    } catch (error) {
      console.error('Error downloading area:', error)
      toast.error('Failed to download area for offline use')
    } finally {
      setDownloading(null)
    }
  }

  async function downloadAllAreasForOffline() {
    if (!selectedSite || !isOnline) return
    
    setDownloading('ALL')
    try {
      // Fetch all signs for all areas
      const signs = await getProjectSignCatalog(selectedSite.id, undefined)
      
      // Cache the signs with no specific area
      await offlineStorage.cacheSignCatalog(selectedSite.id, undefined, signs)
      
      // Cache the site
      await offlineStorage.cacheSite({
        id: selectedSite.id,
        name: selectedSite.name,
        location: selectedSite.location,
        created_at: selectedSite.created_at
      })
      
      setAllAreasDownloaded(true)
      toast.success(`Downloaded all areas for offline use (${signs.length} signs)`)
    } catch (error) {
      console.error('Error downloading all areas:', error)
      toast.error('Failed to download all areas for offline use')
    } finally {
      setDownloading(null)
    }
  }

  function handleAreaSelect(area: ProjectArea) {
    sessionStorage.setItem('selectedArea', JSON.stringify(area))
    router.push('/inventory')
  }

  function handleAllAreasSelect() {
    sessionStorage.removeItem('selectedArea')
    router.push('/inventory')
  }

  function handleBackToProjects() {
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToProjects}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Select Area</h1>
                {selectedSite && (
                  <p className="text-sm text-gray-500">{selectedSite.name}</p>
                )}
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
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <div className="relative">
          <button
            onClick={handleAllAreasSelect}
            className="w-full bg-blue-600 text-white rounded-lg p-4 text-left hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mb-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium">All Areas</h3>
                <p className="text-sm text-blue-100 mt-1">
                  Inventory all signs across all areas
                </p>
                {allAreasDownloaded && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-200 mt-1">
                    <CheckCircle className="h-3 w-3" />
                    Available offline
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isOnline && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      downloadAllAreasForOffline()
                    }}
                    disabled={downloading === 'ALL' || allAreasDownloaded}
                    className="p-2 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50"
                    title={allAreasDownloaded ? 'Already downloaded' : 'Download for offline use'}
                  >
                    {downloading === 'ALL' ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    ) : allAreasDownloaded ? (
                      <CheckCircle className="h-5 w-5 text-green-300" />
                    ) : (
                      <Download className="h-5 w-5 text-white" />
                    )}
                  </button>
                )}
                <Building2 className="h-5 w-5 text-blue-100 flex-shrink-0" />
              </div>
            </div>
          </button>
        </div>

        {areas.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Areas Found</h3>
            <p className="text-gray-500">No specific areas are defined for this project.</p>
            <p className="text-gray-500 mt-2">Use &quot;All Areas&quot; to inventory all signs.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Specific Areas</h2>
            {areas.map((area) => (
              <div key={area.id} className="relative">
                <button
                  onClick={() => handleAreaSelect(area)}
                  className="w-full bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{area.area_name}</h3>
                      {downloadedAreas.has(area.id) && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-1">
                          <CheckCircle className="h-3 w-3" />
                          Available offline
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isOnline && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            downloadAreaForOffline(area)
                          }}
                          disabled={downloading === area.id || downloadedAreas.has(area.id)}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                          title={downloadedAreas.has(area.id) ? 'Already downloaded' : 'Download for offline use'}
                        >
                          {downloading === area.id ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                          ) : downloadedAreas.has(area.id) ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <Download className="h-5 w-5 text-gray-600" />
                          )}
                        </button>
                      )}
                      <MapPin className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}

        {!isOnline && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <WifiOff className="h-5 w-5 text-yellow-600 mr-2" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">Offline Mode</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Limited functionality available. Data will sync when connection is restored.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}