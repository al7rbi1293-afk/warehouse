'use server'

import { createSession, deleteSession } from '@/lib/session'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'
import { redirect } from 'next/navigation'

function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex')
}

export async function login(prevState: any, formData: FormData) {
    const username = formData.get('username') as string
    const password = formData.get('password') as string

    if (!username || !password) {
        return { error: 'Please enter both username and password' }
    }

    try {
        // 1. Fetch user
        const { data: users, error } = await supabase
            .from('users')
            .select('*, shifts(name)')
            .eq('username', username)
            .limit(1)

        if (error) throw error
        const user = users?.[0]

        if (!user) {
            return { error: 'Invalid credentials' }
        }

        // 2. Verify Password (SHA256)
        // Legacy fallback check (plain text) handled in original app, but we enforce hash here for security
        // Only supporting hashed passwords or exact match if legacy plain text
        const inputHash = hashPassword(password)
        let isValid = user.password === inputHash

        // Fallback: check plain text if hash fails (legacy support)
        if (!isValid && user.password === password) {
            isValid = true
            // Note: In a real app we would upgrade the hash here, but for simplicity we just allow it
        }

        if (!isValid) {
            return { error: 'Invalid credentials' }
        }

        // 3. Create Session
        await createSession({
            username: user.username,
            name: user.name,
            role: user.role,
            region: user.region,
            shift_id: user.shift_id
        })

        redirect('/dashboard') // Redirect handled by Next.js
    } catch (error) {
        // Redirect throws an error, so we must rethrow it
        if ((error as any).message === 'NEXT_REDIRECT') throw error
        console.error('Login error:', error)
        return { error: 'Something went wrong' }
    }
}

export async function logout() {
    await deleteSession()
    redirect('/login')
}
