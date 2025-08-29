'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAssignedSites, getCurrentUserProfile, Site, UserProfile } from '@/lib/supabase'
import { useOnlineStatus, offlineStorage } from '@/lib/offline-storage'
import { Building2, Wifi, WifiOff, Settings, BarChart3 } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import toast from 'react-hot-toast'

export default function ProjectSelection() {
  const [sites, setSites] = useState<Site[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const isOnline = useOnlineStatus()

  useEffect(() => {
    loadData()
  }, [isOnline]) // Reload when online status changes

  async function loadData() {
    try {
      console.log('Loading user data...')
      
      // Try to load from offline cache first if offline
      if (!isOnline) {
        const cachedSites = await offlineStorage.getCachedSites()
        if (cachedSites.length > 0) {
          setSites(cachedSites)
          toast.success('Loading sites from offline cache')
          setLoading(false)
          return
        }
      }
      
      // Online - fetch fresh data
      const [profileData, sitesData] = await Promise.all([
        getCurrentUserProfile().catch(err => {
          console.error('Profile loading failed:', err)
          return null
        }),
        getAssignedSites().catch(err => {
          console.error('Sites loading failed:', err)
          return []
        })
      ])
      
      console.log('Profile data:', profileData)
      console.log('Sites data:', sitesData)
      console.log('User role for dashboard button:', profileData?.role)
      
      setUserProfile(profileData)
      setSites(sitesData)
      
      // Cache sites for offline use if any are available
      if (sitesData.length > 0 && isOnline) {
        for (const site of sitesData) {
          await offlineStorage.cacheSite(site)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error(`Failed to load projects: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  function handleSiteSelect(site: Site) {
    sessionStorage.setItem('selectedSite', JSON.stringify(site))
    router.push('/areas')
  }

  function handleManagerDashboard() {
    router.push('/manager')
  }

  function handleInventoryDashboard() {
    router.push('/dashboard?t=' + Date.now()) // Cache busting
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
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Select Project</h1>
              {userProfile && (
                <p className="text-sm text-gray-600 capitalize">
                  {userProfile.role} • {userProfile.full_name || userProfile.email}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {userProfile && (
                <button
                  onClick={handleInventoryDashboard}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Inventory Dashboard"
                >
                  <BarChart3 className="h-5 w-5" />
                </button>
              )}
              {userProfile?.role === 'manager' && (
                <button
                  onClick={handleManagerDashboard}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Manager Settings"
                >
                  <Settings className="h-5 w-5" />
                </button>
              )}
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
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        {sites.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Found</h3>
            <p className="text-gray-500">
              {userProfile?.role === 'installer' 
                ? 'No projects have been assigned to you yet. Please contact your manager.'
                : 'No projects are available at this time.'
              }
            </p>
            {(userProfile?.role === 'manager' || userProfile?.role === 'project_manager') && (
              <div className="mt-4 flex gap-3 justify-center">
                <button
                  onClick={handleInventoryDashboard}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  View Dashboard
                </button>
                {userProfile?.role === 'manager' && (
                  <button
                    onClick={handleManagerDashboard}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Manager Settings
                  </button>
                )}
              </div>
            )}
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
