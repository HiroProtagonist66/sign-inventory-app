'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSites, Site } from '@/lib/supabase'
import { useOnlineStatus } from '@/lib/offline-storage'
import { Building2, Wifi, WifiOff } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import toast from 'react-hot-toast'

export default function ProjectSelection() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const isOnline = useOnlineStatus()

  useEffect(() => {
    loadSites()
  }, [])

  async function loadSites() {
    try {
      const data = await getSites()
      setSites(data)
    } catch (error) {
      console.error('Error loading sites:', error)
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  function handleSiteSelect(site: Site) {
    sessionStorage.setItem('selectedSite', JSON.stringify(site))
    router.push('/areas')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Select Project</h1>
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
        {sites.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Found</h3>
            <p className="text-gray-500">No projects are available at this time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sites.map((site) => (
              <button
                key={site.id}
                onClick={() => handleSiteSelect(site)}
                className="w-full bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{site.name}</h3>
                  </div>
                  <Building2 className="h-5 w-5 text-gray-400 ml-3 flex-shrink-0" />
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
    </AuthGuard>
  )
}
