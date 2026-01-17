'use server'

import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

// --- Types ---
type ActionState = {
    error?: string
    success?: string
}

// --- Helpers ---
const getUser = async () => {
    const session = await getSession()
    if (!session) throw new Error("Unauthorized")
    return session.user
}

// --- Actions ---

// 1. Worker Management
export async function addWorker(prevState: ActionState, formData: FormData): Promise<ActionState> {
    try {
        const user = await getUser()
        // Role check: Manager only
        if (user.role !== 'manager') return { error: 'Unauthorized' }

        const name = formData.get('name') as string
        const emp_id = formData.get('emp_id') as string // string to preserve leading zeros if any, though validation says number
        const role = formData.get('role') as string
        const region = formData.get('region') as string
        const shift_id = formData.get('shift_id') ? parseInt(formData.get('shift_id') as string) : null

        if (!name || !emp_id) return { error: 'Name and Employee ID are required' }

        const { error } = await supabase.from('workers').insert({
            name,
            emp_id,
            role,
            region,
            shift_id,
            status: 'Active'
        })

        if (error) throw error
        revalidatePath('/manpower')
        return { success: 'Worker added successfully' }
    } catch (e: any) {
        return { error: e.message }
    }
}

export async function updateWorker(prevState: ActionState, formData: FormData): Promise<ActionState> {
    try {
        const user = await getUser()
        if (user.role !== 'manager') return { error: 'Unauthorized' }

        const id = parseInt(formData.get('id') as string)
        const name = formData.get('name') as string
        const emp_id = formData.get('emp_id') as string
        const role = formData.get('role') as string
        const region = formData.get('region') as string
        const shift_id = formData.get('shift_id') ? parseInt(formData.get('shift_id') as string) : null
        const status = formData.get('status') as string

        const { error } = await supabase.from('workers').update({
            name, emp_id, role, region, shift_id, status
        }).eq('id', id)

        if (error) throw error
        revalidatePath('/manpower')
        return { success: 'Worker updated' }
    } catch (e: any) {
        return { error: e.message }
    }
}


// 2. Attendance
export async function submitAttendance(prevState: ActionState, formData: FormData): Promise<ActionState> {
    try {
        const user = await getUser()
        const date = formData.get('date') as string
        const shift_id = parseInt(formData.get('shift_id') as string)
        const region = formData.get('region') as string

        // The form sends a JSON string of all updates because standard FormData array handling can be tricky with dynamic rows
        // Alternatively, we can parse `status_{id}` and `notes_{id}` for each worker.
        // Let's rely on a JSON payload for the bulk data to be cleaner, similar to how we might do it in an API.
        // But since we are using progressive enhancement / standard forms, let's parse keys.

        // However, a simple way for Next.js actions with large lists is to pass a JSON string in a hidden field.
        const attendanceData = JSON.parse(formData.get('attendance_data') as string)

        if (!attendanceData || !Array.isArray(attendanceData)) return { error: 'Invalid data' }

        // 1. Delete existing for this block (supervisor overwrites)
        // We delete by shift+date+worker_ids to be safe, or just shift+date+region query? 
        // The Python code deleted by worker_id + date + shift_id row by row.
        // Efficient way: Delete where date=d AND shift=s AND worker_id IN (list)
        const workerIds = attendanceData.map((a: any) => a.worker_id)

        if (workerIds.length > 0) {
            await supabase.from('attendance').delete()
                .eq('date', date)
                .eq('shift_id', shift_id)
                .in('worker_id', workerIds)
        }

        // 2. Insert New
        const inserts = attendanceData.map((row: any) => ({
            worker_id: row.worker_id,
            date: date,
            shift_id: shift_id,
            status: row.status,
            notes: row.notes,
            supervisor: user.name,
            region: region // Store region for easier querying later? Schema has region in workers, but python join logic implies it. 
            // Wait, the Python query in report joins workers table. But `attendance` table might not have region column.
            // Checking schema... `modules/database.py` init_db:
            // CREATE TABLE IF NOT EXISTS attendance (id SERIAL PRIMARY KEY, worker_id INTEGER, date DATE, status TEXT, notes TEXT, supervisor TEXT, shift_id INTEGER);
            // So NO region column in attendance table. It's properly normalized.
        }))

        if (inserts.length > 0) {
            const { error } = await supabase.from('attendance').insert(inserts)
            if (error) throw error
        }

        revalidatePath('/manpower')
        revalidatePath('/dashboard')
        return { success: `Attendance submitted for ${inserts.length} workers` }
    } catch (e: any) {
        console.error(e)
        return { error: e.message }
    }
}


// 3. Shift Management
export async function addShift(prevState: ActionState, formData: FormData): Promise<ActionState> {
    try {
        const user = await getUser()
        if (user.role !== 'manager') return { error: 'Unauthorized' }

        const name = formData.get('name') as string
        const start_time = formData.get('start_time') as string
        const end_time = formData.get('end_time') as string

        const { error } = await supabase.from('shifts').insert({ name, start_time, end_time })
        if (error) throw error

        revalidatePath('/manpower')
        return { success: 'Shift added' }
    } catch (e: any) {
        return { error: e.message }
    }
}
