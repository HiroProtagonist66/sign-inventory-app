import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  // Temporarily disable middleware for mobile debugging
  // The cookie detection isn't working properly on mobile browsers
  console.log('Middleware: Allowing all requests for mobile debugging')
  return res
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|sw.js|manifest.json).*)',
  ],
}