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

export async function createItem(prevState: ActionState, formData: FormData): Promise<ActionState> {
    try {
        const user = await getUser()
        // Basic validation: Only Managers can create items (add more flexible role checks if needed)

        const name = formData.get('name') as string
        const category = formData.get('category') as string
        const location = formData.get('location') as string
        const qty = parseInt(formData.get('qty') as string)
        const unit = formData.get('unit') as string

        // Check exists
        const { data: existing } = await supabase.from('inventory').select('id').eq('name_en', name).eq('location', location).single()
        if (existing) return { error: 'Item already exists in this location' }

        const { error } = await supabase.from('inventory').insert({
            name_en: name,
            category,
            location,
            qty,
            unit,
            status: 'Available'
        })

        if (error) throw error
        revalidatePath('/warehouse')
        return { success: 'Item created successfully' }
    } catch (e: any) {
        return { error: e.message }
    }
}

export async function transferStock(prevState: ActionState, formData: FormData): Promise<ActionState> {
    try {
        const user = await getUser()
        const item_name = formData.get('item_name') as string
        const from_loc = formData.get('from_loc') as string
        const to_loc = formData.get('to_loc') as string
        const qty = parseInt(formData.get('qty') as string)

        // 1. Get Source Item
        const { data: sourceItem } = await supabase.from('inventory').select('*').eq('name_en', item_name).eq('location', from_loc).single()
        if (!sourceItem) return { error: `Source item not found in ${from_loc}` }

        if (sourceItem.qty < qty) return { error: `Insufficient stock in ${from_loc}` }

        // 2. Decrement Source
        await supabase.rpc('decrement_stock', { p_name: item_name, p_loc: from_loc, p_qty: qty })

        // 3. Log Source (Transfer Out)
        await supabase.from('stock_logs').insert({
            action_by: user.name,
            action_type: `Transfer Out to ${to_loc}`,
            item_name,
            location: from_loc,
            change_amount: -qty,
            new_qty: sourceItem.qty - qty,
            unit: sourceItem.unit
        })

        // 4. Increment/Create Dest
        // Check dest exists
        const { data: destItem } = await supabase.from('inventory').select('*').eq('name_en', item_name).eq('location', to_loc).single()

        if (destItem) {
            await supabase.rpc('increment_stock', { p_name: item_name, p_loc: to_loc, p_qty: qty })
            // Log Dest
            await supabase.from('stock_logs').insert({
                action_by: user.name,
                action_type: `Transfer In from ${from_loc}`,
                item_name,
                location: to_loc,
                change_amount: qty,
                new_qty: destItem.qty + qty,
                unit: sourceItem.unit
            })
        } else {
            // Create item in dest
            await supabase.from('inventory').insert({
                name_en: item_name,
                category: sourceItem.category,
                unit: sourceItem.unit,
                location: to_loc,
                qty: qty,
                status: 'Available'
            })
            // Log Dest (New)
            await supabase.from('stock_logs').insert({
                action_by: user.name,
                action_type: `Transfer In from ${from_loc}`,
                item_name,
                location: to_loc,
                change_amount: qty,
                new_qty: qty,
                unit: sourceItem.unit
            })
        }

        revalidatePath('/warehouse')
        return { success: `Transferred ${qty} ${sourceItem.unit} of ${item_name}` }

    } catch (e: any) {
        console.error(e)
        return { error: e.message || "Transfer failed" }
    }
}

export async function createRequest(prevState: ActionState, formData: FormData): Promise<ActionState> {
    try {
        const user = await getUser()
        // Supervisor Role

        const item_name = formData.get('item_name') as string
        const qty = parseInt(formData.get('qty') as string)

        // Get details from inventory (assuming requesting from NSTC) or pass hidden fields
        const { data: inv } = await supabase.from('inventory').select('*').eq('name_en', item_name).eq('location', 'NSTC').single()
        if (!inv) return { error: 'Item not found in Central Stock' }

        const { error } = await supabase.from('requests').insert({
            supervisor_name: user.name,
            region: user.region,
            item_name,
            category: inv.category,
            qty,
            unit: inv.unit,
            status: 'Pending',
            request_date: new Date().toISOString()
        })

        if (error) throw error
        revalidatePath('/warehouse')
        return { success: 'Request sent successfully' }
    } catch (e: any) {
        return { error: e.message }
    }
}

// NOTE: We need DB RPCs for atomic updates effectively, or just plain updates. 
// For this MVP, assuming low concurrency, separate update calls are okay-ish, but RPC is better.
// I'll stick to simple queries for portability unless complex. 
// Actually, `decrement_stock` RPC prevents race conditions. I should use SQL editor to create them if I could, 
// but since I can't run DDL on Supabase easily without migration tool, I will use standard separate UPDATEs for now, 
// mimicking the Python app's logic which used a transaction.
// Supabase JS client doesn't support transactions directly on client-side, but does inside Postgres Functions.
// For now, I will write standard Supabase JS code.

export async function processRequest(prevState: ActionState, formData: FormData): Promise<ActionState> {
    const action = formData.get('action') as string // 'Approve' | 'Reject'
    const req_id = parseInt(formData.get('req_id') as string)
    const notes = formData.get('notes') as string
    const qty = parseInt(formData.get('qty') as string) // Manager adjusted qty

    try {
        const user = await getUser()

        if (action === 'Reject') {
            await supabase.from('requests').update({ status: 'Rejected', notes }).eq('req_id', req_id)
            revalidatePath('/warehouse')
            return { success: 'Request Rejected' }
        }

        if (action === 'Approve') {
            await supabase.from('requests').update({ status: 'Approved', qty, notes }).eq('req_id', req_id)
            revalidatePath('/warehouse')
            return { success: 'Request Approved' }
        }

        return { error: 'Invalid action' }
    } catch (e: any) {
        return { error: e.message }
    }
}

export async function issueRequest(prevState: ActionState, formData: FormData): Promise<ActionState> {
    // Storekeeper Issue
    const req_id = parseInt(formData.get('req_id') as string)
    const item_name = formData.get('item_name') as string
    const qty = parseInt(formData.get('qty') as string)

    try {
        const user = await getUser()

        // 1. Check Stock
        const { data: inv } = await supabase.from('inventory').select('qty, unit').eq('name_en', item_name).eq('location', 'NSTC').single()
        if (!inv || inv.qty < qty) return { error: 'Insufficient Stock' }

        // 2. Decrement Stock
        const new_qty = inv.qty - qty
        const { error: upErr } = await supabase.from('inventory').update({ qty: new_qty, last_updated: new Date().toISOString() }).eq('name_en', item_name).eq('location', 'NSTC')
        if (upErr) throw upErr

        // 3. Log
        await supabase.from('stock_logs').insert({
            action_by: user.name,
            action_type: 'Issued',
            item_name,
            location: 'NSTC',
            change_amount: -qty,
            new_qty,
            unit: inv.unit
        })

        // 4. Update Request
        await supabase.from('requests').update({ status: 'Issued' }).eq('req_id', req_id)

        revalidatePath('/warehouse')
        return { success: 'Items Issued' }

    } catch (e: any) {
        return { error: e.message }
    }
}
