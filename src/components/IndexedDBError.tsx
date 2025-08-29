'use client'

import { useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { resetIndexedDB } from '@/lib/offline-storage'
import toast from 'react-hot-toast'

export default function IndexedDBError({ error }: { error?: Error }) {
  const [isResetting, setIsResetting] = useState(false)

  const handleReset = async () => {
    setIsResetting(true)
    try {
      await resetIndexedDB()
      toast.success('Database reset successfully. Refreshing page...')
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (err) {
      console.error('Failed to reset database:', err)
      toast.error('Failed to reset database. Please try clearing your browser data.')
    } finally {
      setIsResetting(false)
    }
  }

  if (!error) return null

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <h2 className="text-xl font-semibold text-gray-900">Database Error</h2>
        </div>
        
        <p className="text-gray-600 mb-4">
          There was an issue with the offline storage database. This can happen after updates.
        </p>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-800 font-mono">
            {error.message || 'Unknown database error'}
          </p>
        </div>
        
        <button
          onClick={handleReset}
          disabled={isResetting}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isResetting ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Resetting Database...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Reset Database
            </>
          )}
        </button>
        
        <p className="text-xs text-gray-500 mt-4">
          Note: This will clear all offline data. You&apos;ll need to download areas again for offline use.
        </p>
      </div>
    </div>
  )
}