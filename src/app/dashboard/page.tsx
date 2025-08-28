'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUserProfile, type UserProfile } from '@/lib/supabase'
import AuthGuard from '@/components/AuthGuard'
import InventoryDashboard from '@/components/InventoryDashboard'
import { BarChart3, AlertCircle } from 'lucide-react'

export default function DashboardPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    loadUserProfile()
  }, [])

  const loadUserProfile = async () => {
    try {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        router.push('/login')
        return
      }

      // Only managers and project managers can access dashboard
      if (profile.role !== 'manager' && profile.role !== 'project_manager') {
        router.push('/')
        return
      }

      setUserProfile(profile)
    } catch (error) {
      console.error('Error loading user profile:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </AuthGuard>
    )
  }

  if (!userProfile || (userProfile.role !== 'manager' && userProfile.role !== 'project_manager')) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">
              You don&apos;t have permission to view the dashboard.
            </p>
          </div>
        </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Inventory Dashboard
                  </h1>
                  <p className="text-sm text-gray-500">
                    {userProfile.role === 'project_manager' ? 'Project Manager' : 'Manager'} View
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Logged in as</p>
                <p className="font-medium text-gray-900">
                  {userProfile.full_name || userProfile.email}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <InventoryDashboard userRole={userProfile.role} />
      </div>
    </AuthGuard>
  )
}