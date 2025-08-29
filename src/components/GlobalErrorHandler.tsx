'use client'

import { useEffect } from 'react'

export default function GlobalErrorHandler() {
  useEffect(() => {
    // Handle errors from browser extensions
    const handleError = (event: ErrorEvent) => {
      // Ignore custom element errors from browser extensions
      if (event.error?.message?.includes('custom element') || 
          event.error?.message?.includes('mce-autosize-textarea') ||
          event.error?.message?.includes('webcomponents')) {
        event.preventDefault()
        console.log('Suppressed browser extension error:', event.error?.message)
        return
      }
      
      // Let other errors propagate normally
      console.error('Global error:', event.error)
    }

    // Handle unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      // Ignore certain known issues
      if (event.reason?.message?.includes('custom element')) {
        event.preventDefault()
        return
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return null
}