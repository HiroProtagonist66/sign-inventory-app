'use client'

import { useEffect } from 'react'

export default function GlobalErrorHandler() {
  useEffect(() => {
    // Create a more comprehensive error handler
    const handleError = (event: ErrorEvent) => {
      const message = event.message || ''
      const source = event.filename || ''
      
      // Suppress wallet extension errors completely
      if (
        message.includes('ethereum') ||
        message.includes('MetaMask') ||
        message.includes('wallet') ||
        message.includes('selectedAddress') ||
        message.includes('web3') ||
        message.includes('undefined is not an object') ||
        source.includes('extension')
      ) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        return false
      }
    }

    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason?.toString() || ''
      if (
        message.includes('ethereum') ||
        message.includes('MetaMask') ||
        message.includes('wallet') ||
        message.includes('selectedAddress') ||
        message.includes('web3')
      ) {
        event.preventDefault()
        event.stopPropagation()
        return false
      }
    }

    // Override console.error to suppress extension errors
    const originalConsoleError = console.error
    console.error = (...args) => {
      const message = args[0]?.toString() || ''
      if (
        message.includes('ethereum') ||
        message.includes('MetaMask') ||
        message.includes('wallet') ||
        message.includes('selectedAddress') ||
        message.includes('web3') ||
        message.includes('undefined is not an object')
      ) {
        return // Completely ignore these errors
      }
      originalConsoleError.apply(console, args)
    }

    // Add event listeners with capture phase to catch errors early
    window.addEventListener('error', handleError, { capture: true, passive: false })
    window.addEventListener('unhandledrejection', handleUnhandledRejection, { capture: true, passive: false })

    return () => {
      console.error = originalConsoleError
      window.removeEventListener('error', handleError, { capture: true })
      window.removeEventListener('unhandledrejection', handleUnhandledRejection, { capture: true })
    }
  }, [])

  return null
}