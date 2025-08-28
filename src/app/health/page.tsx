'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function HealthCheck() {
  const [status, setStatus] = useState<{
    supabase: boolean
    auth: boolean
    database: boolean
    error?: string
  }>({
    supabase: false,
    auth: false,
    database: false
  })

  useEffect(() => {
    async function checkHealth() {
      try {
        // Check Supabase connection
        const { data: { session } } = await supabase.auth.getSession()
        
        setStatus(prev => ({
          ...prev,
          supabase: true,
          auth: !!session
        }))

        // Test database connection
        const { error } = await supabase
          .from('sites')
          .select('count')
          .limit(1)

        if (error) {
          throw new Error(`Database error: ${error.message}`)
        }

        setStatus(prev => ({
          ...prev,
          database: true
        }))

      } catch (error) {
        console.error('Health check failed:', error)
        setStatus(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      }
    }

    checkHealth()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">System Health Check</h1>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Supabase Client</span>
            <span className={`px-2 py-1 rounded text-sm ${
              status.supabase 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {status.supabase ? '✅ Connected' : '❌ Failed'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-700">Authentication</span>
            <span className={`px-2 py-1 rounded text-sm ${
              status.auth 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {status.auth ? '✅ Authenticated' : '⚠️ Not Logged In'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-700">Database</span>
            <span className={`px-2 py-1 rounded text-sm ${
              status.database 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {status.database ? '✅ Connected' : '❌ Failed'}
            </span>
          </div>
        </div>

        {status.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            <h3 className="font-medium text-red-800 mb-2">Error Details:</h3>
            <p className="text-sm text-red-700">{status.error}</p>
          </div>
        )}

        <div className="mt-6 text-center">
          <button 
            onClick={() => window.location.href = '/'}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            ← Back to App
          </button>
        </div>
      </div>
    </div>
  )
}