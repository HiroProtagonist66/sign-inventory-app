'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('AuthGuard: Initial session check:', !!session?.user)
      setUser(session?.user ?? null)
      setLoading(false)

      // If no session, redirect to login
      if (!session?.user) {
        console.log('AuthGuard: No user found, redirecting to login')
        router.push('/login')
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('AuthGuard: Auth state changed:', _event, !!session?.user)
      setUser(session?.user ?? null)
      
      if (!session?.user) {
        console.log('AuthGuard: User signed out, redirecting to login')
        router.push('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Show login redirect message if no user
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Redirecting to login...</h2>
          <p className="text-gray-500">Please wait while we redirect you to the login page.</p>
        </div>
      </div>
    )
  }

  // Render children if authenticated
  return <>{children}</>
}