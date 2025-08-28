'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getProjectAreas, ProjectArea, Site } from '@/lib/supabase'
import { useOnlineStatus } from '@/lib/offline-storage'
import { ArrowLeft, MapPin, Wifi, WifiOff, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AreaSelection() {
  const [areas, setAreas] = useState<ProjectArea[]>([])
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [loading, setLoading] = useState(true)
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
  }, [router])

  async function loadAreas(siteId: string) {
    try {
      const data = await getProjectAreas(siteId)
      setAreas(data)
    } catch (error) {
      console.error('Error loading areas:', error)
      toast.error('Failed to load areas')
    } finally {
      setLoading(false)
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
            </div>
            <Building2 className="h-5 w-5 text-blue-100 ml-3 flex-shrink-0" />
          </div>
        </button>

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
              <button
                key={area.id}
                onClick={() => handleAreaSelect(area)}
                className="w-full bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{area.area_name}</h3>
                  </div>
                  <MapPin className="h-5 w-5 text-gray-400 ml-3 flex-shrink-0" />
                </div>
              </button>
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