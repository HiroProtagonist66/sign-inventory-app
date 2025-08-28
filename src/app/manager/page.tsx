'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUserProfile, UserProfile } from '@/lib/supabase'
import AuthGuard from '@/components/AuthGuard'
import ManagerDashboard from '@/components/ManagerDashboard'
import { ArrowLeft } from 'lucide-react'

export default function ManagerPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    loadUserProfile()
  }, [])

  async function loadUserProfile() {
    try {
      const profile = await getCurrentUserProfile()
      setUserProfile(profile)
      
      // Redirect if not a manager
      if (profile && profile.role !== 'manager') {
        router.push('/')
        return
      }
    } catch (error) {
      console.error('Error loading user profile:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  function handleBackToSites() {
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!userProfile || userProfile.role !== 'manager') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You need manager permissions to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Back button */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <button
              onClick={handleBackToSites}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Projects
            </button>
          </div>
        </div>

        <ManagerDashboard />
      </div>
    </AuthGuard>
  )
}