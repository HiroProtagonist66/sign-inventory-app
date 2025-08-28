'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Lock, Mail, Eye, EyeOff, AlertCircle, User } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    // Check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/')
        router.refresh()
      }
    })
  }, [])

  // Debug: Track when isSignUp changes
  useEffect(() => {
    console.log('isSignUp changed to:', isSignUp)
  }, [isSignUp])

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    
    if (!email || !password) {
      toast.error('Please fill in all fields')
      return
    }

    if (isSignUp && !fullName.trim()) {
      toast.error('Please enter your full name')
      return
    }

    setLoading(true)

    try {
      // Wrap the entire auth flow to prevent extension errors from breaking it
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim()
            }
          }
        })

        console.log('SignUp response:', { data, error })

        if (error) throw error

        if (data.user) {
          toast.success('Account created! Please check your email for verification.')
          setIsSignUp(false)
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        console.log('SignIn response:', { data, error })
        console.log('User:', data.user)
        console.log('Session:', data.session)

        if (error) throw error

        if (data.user && data.session) {
          toast.success('Logged in successfully!')
          console.log('About to redirect...')
          
          // Prevent any extension interference during redirect
          try {
            setTimeout(() => {
              window.location.href = '/'
            }, 1000)
          } catch (redirectError) {
            // Fallback if redirect fails
            console.log('Redirect error, trying alternative method')
            window.location.replace('/')
          }
        } else {
          console.log('No user or session in response')
          toast.error('Login succeeded but no session created')
        }
      }
    } catch (error: unknown) {
      // Filter out extension-related errors
      const errorMessage = (error as Error).message || String(error) || ''
      if (
        errorMessage.includes('ethereum') ||
        errorMessage.includes('selectedAddress') ||
        errorMessage.includes('MetaMask') ||
        errorMessage.includes('wallet')
      ) {
        // Ignore extension errors and just show success
        toast.success('Logged in successfully!')
        setTimeout(() => {
          window.location.href = '/'
        }, 1000)
        return
      }
      
      console.error('Auth error:', error)
      toast.error((error as Error).message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center">
      <div className="max-w-md w-full mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Lock className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isSignUp ? 'Create Account' : 'Sign In'}
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              {isSignUp 
                ? 'Sign up to access the inventory system' 
                : 'Sign in to your account to continue'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4" suppressHydrationWarning>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                  suppressHydrationWarning
                />
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>

            {isSignUp && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                    suppressHydrationWarning
                  />
                  <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-2 pl-10 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                  suppressHydrationWarning
                />
                <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {isSignUp && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium mb-1">Password Requirements:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-xs">
                      <li>At least 6 characters long</li>
                      <li>Include numbers and letters for better security</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('Toggle button clicked, switching from', isSignUp ? 'signup' : 'signin', 'to', !isSignUp ? 'signup' : 'signin')
                setIsSignUp(!isSignUp)
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
              disabled={loading}
            >
              {isSignUp 
                ? 'Already have an account? Sign in' 
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          Sign Inventory System - Internal Use Only
        </div>
      </div>
    </div>
  )
}