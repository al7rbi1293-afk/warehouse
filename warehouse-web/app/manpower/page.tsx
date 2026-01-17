import { getSession } from "@/lib/session"
import { supabase } from "@/lib/supabase"
import { redirect } from "next/navigation"
import ManpowerClientView from "./client-view"

export default async function ManpowerPage() {
    const session = await getSession()
    if (!session) redirect('/login')

    // Fetch Data
    // 1. Shifts (Common)
    const { data: shifts } = await supabase.from('shifts').select('*').order('id')

    // 2. Data based on Role
    let workers = []
    let supervisorTargetShiftId = null

    if (session.user.role === 'manager') {
        const { data } = await supabase.from('workers').select('*, shifts(name)').order('id', { ascending: false })
        workers = data || []
    }
    else if (session.user.role === 'supervisor' || session.user.role === 'night_supervisor') {
        // Supervisor Logic: Map Shift A -> A1, B -> B1
        const myShiftId = session.user.shift_id
        // We need to know the NAME of my shift to map it, or use a known ID mapping convention.
        // Since IDs are auto-increment, names are safer.
        const myShift = shifts?.find(s => s.id === myShiftId)

        if (myShift) {
            let targetShiftName = myShift.name
            if (['A', 'A2'].includes(myShift.name)) targetShiftName = 'A1'
            if (['B', 'B2'].includes(myShift.name)) targetShiftName = 'B1'

            const targetShift = shifts?.find(s => s.name === targetShiftName)
            if (targetShift) {
                supervisorTargetShiftId = targetShift.id
                // Fetch workers for my region AND target shift
                const regions = session.user.region.split(',')
                const { data } = await supabase.from('workers')
                    .select('*')
                    .in('region', regions)
                    .eq('shift_id', targetShift.id)
                    .eq('status', 'Active')
                    .order('name')
                workers = data || []
            }
        }
    }

    // 3. Today's Attendance snapshot (for reports/viewing) if needed, 
    // but client view can fetch or we pass empty and let client handle date selection?
    // Better to fetch on client for date changing, or server component with searchParams.
    // For simplicity, we'll pass initial data.

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Manpower Management</h1>
                <p className="text-gray-500">Role: <span className="capitalize font-medium text-gray-900">{session.user.role}</span></p>
            </div>

            <ManpowerClientView
                role={session.user.role}
                user={session.user}
                shifts={shifts || []}
                workers={workers}
                supervisorTargetShiftId={supervisorTargetShiftId}
            />
        </div>
    )
}
