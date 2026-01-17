'use client'

import { useState } from 'react'
import { addWorker, addShift, submitAttendance } from "@/app/actions/manpower"
import { cn } from "@/lib/utils"
import { Users, ClipboardCheck, Clock, FileBarChart } from "lucide-react"

export default function ManpowerClientView({ role, user, shifts, workers, supervisorTargetShiftId }: any) {
    const [activeTab, setActiveTab] = useState(role === 'manager' ? 'workers' : 'attendance')

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {(role === 'supervisor' || role === 'night_supervisor') && (
                        <TabButton id="attendance" label="Daily Attendance" icon={ClipboardCheck} active={activeTab} onClick={setActiveTab} />
                    )}
                    {role === 'manager' && (
                        <>
                            <TabButton id="reports" label="Reports" icon={FileBarChart} active={activeTab} onClick={setActiveTab} />
                            <TabButton id="workers" label="Worker Database" icon={Users} active={activeTab} onClick={setActiveTab} />
                            <TabButton id="shifts" label="Shifts" icon={Clock} active={activeTab} onClick={setActiveTab} />
                        </>
                    )}
                    {/* Common Tab */}
                    {(role === 'supervisor' || role === 'night_supervisor') && (
                        <TabButton id="my_workers" label="My Workers" icon={Users} active={activeTab} onClick={setActiveTab} />
                    )}
                </nav>
            </div>

            <div className="mt-6">
                {activeTab === 'workers' && role === 'manager' && <WorkerManager workers={workers} shifts={shifts} />}
                {activeTab === 'shifts' && role === 'manager' && <ShiftManager shifts={shifts} />}
                {activeTab === 'attendance' && <SupervisorAttendance user={user} workers={workers} targetShiftId={supervisorTargetShiftId} />}
                {activeTab === 'my_workers' && <WorkerListSimple workers={workers} />}
                {activeTab === 'reports' && role === 'manager' && <div className="text-gray-500">Reports Module Placeholder (Export functionality would go here)</div>}
            </div>
        </div>
    )
}

function TabButton({ id, label, icon: Icon, active, onClick }: any) {
    return (
        <button
            onClick={() => onClick(id)}
            className={cn(
                active === id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                'group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium'
            )}
        >
            <Icon className={cn("mr-2 h-5 w-5", active === id ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500")} />
            {label}
        </button>
    )
}

// --- Sub-Components ---

function WorkerManager({ workers, shifts }: any) {
    return (
        <div className="space-y-6">
            {/* Add Worker Form */}
            <div className="bg-white p-6 rounded-lg border shadow-sm">
                <h3 className="font-medium text-gray-900 mb-4">Add New Worker</h3>
                <form action={addWorker}>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div><label className="text-xs">Name</label><input name="name" required className="input-std" /></div>
                        <div><label className="text-xs">EMP ID</label><input name="emp_id" required className="input-std" /></div>
                        <div><label className="text-xs">Role</label><input name="role" className="input-std" /></div>
                        <div>
                            <label className="text-xs">Region</label>
                            <select name="region" className="input-std">
                                {/* Hardcoded regions for now, or pass from props */}
                                {["OPD", "Imeging", "Neurodiangnostic", "E.R", "1s floor", "Service Area", "ICU 28", "ICU 29", "O.R", "Recovery", "RT and Waiting area", "Ward 30-31", "Ward 40-41", "Ward50-51"].map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs">Shift</label>
                            <select name="shift_id" className="input-std">
                                {shifts.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <button className="btn-primary mt-4 w-full md:w-auto">Add Worker</button>
                </form>
            </div>

            {/* List */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead><tr><th className="th-std">Name</th><th className="th-std">EMP ID</th><th className="th-std">Role</th><th className="th-std">Region</th><th className="th-std">Shift</th><th className="th-std">Status</th></tr></thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {workers.map((w: any) => (
                            <tr key={w.id}>
                                <td className="td-std font-medium">{w.name}</td>
                                <td className="td-std">{w.emp_id}</td>
                                <td className="td-std">{w.role}</td>
                                <td className="td-std">{w.region}</td>
                                <td className="td-std">{w.shifts?.name}</td>
                                <td className="td-std"><span className={cn("px-2 py-0.5 rounded-full text-xs", w.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>{w.status}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function ShiftManager({ shifts }: any) {
    return (
        <div className="grid gap-6 md:grid-cols-2">
            <div className="bg-white p-6 rounded-lg border shadow-sm h-fit">
                <h3 className="font-medium text-gray-900 mb-4">Add Shift</h3>
                <form action={addShift} className="space-y-4">
                    <div><label className="text-sm">Name</label><input name="name" className="input-std" placeholder="e.g. Morning A" required /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-sm">Start</label><input type="time" name="start_time" className="input-std" required /></div>
                        <div><label className="text-sm">End</label><input type="time" name="end_time" className="input-std" required /></div>
                    </div>
                    <button className="btn-primary">Create Shift</button>
                </form>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead><tr><th className="th-std">Name</th><th className="th-std">Time</th></tr></thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {shifts.map((s: any) => (
                            <tr key={s.id}>
                                <td className="td-std font-medium">{s.name}</td>
                                <td className="td-std text-gray-500">{s.start_time} - {s.end_time}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function SupervisorAttendance({ user, workers, targetShiftId }: any) {
    // State to hold form data before submit
    // In a real app we'd fetch today's EXISTING attendance to pre-fill
    // For MVP, we default to Present
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])

    if (!targetShiftId) return <div className="text-red-500">Error: No target shift assigned to your profile.</div>

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg border shadow-sm flex items-center justify-between">
                <div>
                    <h3 className="font-medium text-lg">Daily Attendance</h3>
                    <p className="text-sm text-gray-500">Recording for: <span className="font-semibold text-gray-900">Shift ID {targetShiftId}</span> in <span className="font-semibold text-gray-900">{user.region}</span></p>
                </div>
                <div>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-std" />
                </div>
            </div>

            <form action={submitAttendance} className="bg-white shadow overflow-hidden sm:rounded-lg">
                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="shift_id" value={targetShiftId} />
                <input type="hidden" name="region" value={user.region} />

                <AttendanceTable workers={workers} />

                <div className="p-4 bg-gray-50 border-t">
                    <button className="btn-primary w-full md:w-auto md:ml-auto">Submit Attendance</button>
                </div>
            </form>
        </div>
    )
}

// Client Component to handle local state of attendance rows
function AttendanceTable({ workers }: any) {
    const [rows, setRows] = useState(workers.map((w: any) => ({ worker_id: w.id, status: 'Present', notes: '' })))

    const updateRow = (id: number, field: string, value: string) => {
        setRows((prev: any) => prev.map((r: any) => r.worker_id === id ? { ...r, [field]: value } : r))
    }

    return (
        <>
            <input type="hidden" name="attendance_data" value={JSON.stringify(rows)} />
            <table className="min-w-full divide-y divide-gray-200">
                <thead><tr><th className="th-std">Worker</th><th className="th-std">Status</th><th className="th-std">Notes</th></tr></thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                    {workers.map((w: any) => {
                        const row = rows.find((r: any) => r.worker_id === w.id)
                        return (
                            <tr key={w.id}>
                                <td className="td-std">
                                    <div className="font-medium text-gray-900">{w.name}</div>
                                    <div className="text-xs text-gray-500">{w.role}</div>
                                </td>
                                <td className="td-std">
                                    <select
                                        className={cn("block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 pl-3 pr-8",
                                            row?.status === 'Absent' ? 'bg-red-50 text-red-900 ring-red-300' : 'ring-gray-300'
                                        )}
                                        value={row?.status}
                                        onChange={(e) => updateRow(w.id, 'status', e.target.value)}
                                    >
                                        {["Present", "Absent", "Vacation", "Day Off", "Eid Holiday", "Sick Leave"].map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="td-std">
                                    <input
                                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 px-3"
                                        placeholder="Note..."
                                        value={row?.notes}
                                        onChange={(e) => updateRow(w.id, 'notes', e.target.value)}
                                    />
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </>
    )
}

function WorkerListSimple({ workers }: any) {
    return (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
                <thead><tr><th className="th-std">Name</th><th className="th-std">Role</th><th className="th-std">Shift</th></tr></thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {workers.map((w: any) => (
                        <tr key={w.id}>
                            <td className="td-std font-medium">{w.name}</td>
                            <td className="td-std text-gray-500">{w.role}</td>
                            <td className="td-std">{w.shifts?.name || '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
