import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSession } from './lib/session'

export async function middleware(request: NextRequest) {
    const session = await getSession()

    // 1. Protect protected routes
    if (request.nextUrl.pathname.startsWith('/dashboard') ||
        request.nextUrl.pathname.startsWith('/warehouse') ||
        request.nextUrl.pathname.startsWith('/manpower')) {
        if (!session) {
            return NextResponse.redirect(new URL('/login', request.url))
        }
    }

    // 2. Redirect authenticated users away from login
    if (request.nextUrl.pathname.startsWith('/login') && session) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
