import { getSession } from "@/lib/session"
import { supabase } from "@/lib/supabase"
import { redirect } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs" // Assuming standard structure, will create simplified valid version below if needed
import { Card, CardContent } from "@/components/ui/card"
import { Package, Truck, ClipboardCheck, History } from "lucide-react"

// Since I don't have the full UI library installed yet, I'll build a simplified inline Tab component or just purely server-side toggle if possible.
// Actually, client-side tabs are better. I'll use a simple client component for tabs or just query params.
// Let's use Query Params for tabs to keep it simple and server-rendered as much as possible, or a Client Component wrapper.

import WarehouseClientView from "./client-view"

export default async function WarehousePage() {
    const session = await getSession()
    if (!session) redirect('/login')

    const userRole = session.user.role // 'manager' | 'supervisor' | 'storekeeper'

    // Fetch Data needed for initial render
    // 1. Inventory (NSTC)
    const { data: inventory_nstc } = await supabase.from('inventory').select('*').eq('location', 'NSTC').order('name_en')

    // 2. Requests (Pending)
    let pendingRequests = []
    if (userRole === 'manager') {
        const { data } = await supabase.from('requests').select('*').eq('status', 'Pending').order('request_date', { ascending: false })
        pendingRequests = data || []
    } else if (userRole === 'supervisor') {
        const { data } = await supabase.from('requests').select('*').eq('supervisor_name', session.user.name).eq('status', 'Pending') // Filter by region too?
        pendingRequests = data || []
    } else if (userRole === 'storekeeper') {
        const { data } = await supabase.from('requests').select('*').eq('status', 'Approved') // SK sees Approved to Issue
        pendingRequests = data || []
    }

    // 3. Loans / External
    const { data: logs } = await supabase.from('stock_logs').select('*').order('log_date', { ascending: false }).limit(50)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Warehouse Management</h1>
                <p className="text-gray-500">Role: <span className="capitalize font-medium text-gray-900">{userRole}</span></p>
            </div>

            <WarehouseClientView
                role={userRole}
                inventory={inventory_nstc || []}
                requests={pendingRequests}
                logs={logs || []}
                user={session.user}
            />
        </div>
    )
}
