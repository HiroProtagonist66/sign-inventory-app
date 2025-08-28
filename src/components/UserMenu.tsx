'use client'

import { useAuth } from '@/lib/auth-context'
import { LogOut, User, Shield } from 'lucide-react'
import { usePathname } from 'next/navigation'

export default function UserMenu() {
  const { user, signOut } = useAuth()
  const pathname = usePathname()

  // Don't show menu on login page
  if (pathname === '/login') return null

  if (!user) return null

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-md mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{user.email}</p>
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3 text-green-600" />
                <p className="text-xs text-gray-500">Authenticated</p>
              </div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}