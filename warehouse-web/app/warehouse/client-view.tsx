'use client'

import { useState } from 'react'
import { createItem, transferStock, createRequest, processRequest, issueRequest } from "@/app/actions/warehouse"
import { useActionState } from 'react' // React 19 / Next.js 15
import { cn } from "@/lib/utils"
// Icons
import { Package, Plus, ArrowRightLeft, CheckCircle, XCircle, Truck, ClipboardList } from "lucide-react"

export default function WarehouseClientView({ role, inventory, requests, logs, user }: any) {
    const [activeTab, setActiveTab] = useState(role === 'manager' ? 'stock' : 'requests')

    return (
        <div className="space-y-6">
            {/* Tabs Navigation */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {role === 'manager' && (
                        <>
                            <TabButton id="stock" label="Stock Management" icon={Package} active={activeTab} onClick={setActiveTab} />
                            <TabButton id="external" label="External & Loans" icon={Truck} active={activeTab} onClick={setActiveTab} />
                            <TabButton id="reviews" label="Bulk Review" icon={ClipboardList} active={activeTab} onClick={setActiveTab} />
                        </>
                    )}
                    {(role === 'supervisor' || role === 'storekeeper') && (
                        <TabButton id="requests" label={role === 'storekeeper' ? 'Issue Items' : 'My Requests'} icon={ClipboardList} active={activeTab} onClick={setActiveTab} />
                    )}
                    <TabButton id="logs" label="Logs" icon={HistoryIcon} active={activeTab} onClick={setActiveTab} />
                </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {activeTab === 'stock' && role === 'manager' && <StockManager inventory={inventory} />}
                {activeTab === 'external' && role === 'manager' && <ExternalManager inventory={inventory} />}
                {activeTab === 'reviews' && role === 'manager' && <RequestReview requests={requests} />}
                {activeTab === 'requests' && role === 'supervisor' && <SupervisorRequests inventory={inventory} myRequests={requests} user={user} />}
                {activeTab === 'requests' && role === 'storekeeper' && <StorekeeperIssue requests={requests} />}
                {activeTab === 'logs' && <LogsViewer logs={logs} />}
            </div>
        </div>
    )
}

function TabButton({ id, label, icon: Icon, active, onClick }: any) {
    return (
        <button
            onClick={() => onClick(id)}
            className={cn(
                active === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                'group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium'
            )}
        >
            <Icon className={cn("mr-2 h-5 w-5", active === id ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500")} />
            {label}
        </button>
    )
}

function HistoryIcon(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" /><path d="M3 3v9h9" /><path d="M12 7v5l4 2" /></svg> }

// --- Sub-Components ---
function StockManager({ inventory }: any) {
    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Create Item Form */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Create New Item</h3>
                <form action={createItem} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-sm font-medium">Name</label><input name="name" required className="input-std" /></div>
                        <div><label className="text-sm font-medium">Category</label><input name="category" required className="input-std" /></div>
                        <div><label className="text-sm font-medium">Location</label>
                            <select name="location" className="input-std">
                                <option value="NSTC">NSTC</option>
                                <option value="SNC">SNC</option>
                            </select>
                        </div>
                        <div><label className="text-sm font-medium">Qty</label><input type="number" name="qty" defaultValue={0} className="input-std" /></div>
                    </div>
                    <div className="mt-2 text-sm"><label className="text-sm font-medium">Unit</label>
                        <select name="unit" className="input-std">
                            <option>Piece</option><option>Carton</option><option>Set</option>
                        </select>
                    </div>
                    <button type="submit" className="btn-primary w-full mt-4">Create Item</button>
                </form>
            </div>

            {/* Inventory List (Simplified) */}
            <div className="rounded-lg border bg-white p-6 shadow-sm overflow-hidden">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">NSTC Inventory</h3>
                <div className="overflow-y-auto max-h-[400px]">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead><tr><th className="th-std">Name</th><th className="th-std">Qty</th><th className="th-std">Unit</th></tr></thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {inventory.map((i: any) => (
                                <tr key={i.id}>
                                    <td className="td-std font-medium">{i.name_en}</td>
                                    <td className="td-std">{i.qty}</td>
                                    <td className="td-std text-gray-500">{i.unit}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

function ExternalManager({ inventory }: any) {
    return (
        <div className="p-6 bg-white rounded-lg border shadow-sm">
            <h3 className="text-lg font-medium mb-4">External Loans / Transfers</h3>
            <p className="text-gray-500 text-sm mb-4">Select an item to transfer or lend.</p>
            {/* Simplified Form */}
            <form action={transferStock} className="space-y-4 max-w-lg">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Item</label>
                    <select name="item_name" className="input-std">
                        {inventory.map((i: any) => <option key={i.id} value={i.name_en}>{i.name_en} (Qty: {i.qty})</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">From</label>
                        <select name="from_loc" className="input-std"><option>NSTC</option><option>SNC</option></select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">To</label>
                        <input name="to_loc" placeholder="Target Location / Project" className="input-std" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Quantity</label>
                    <input type="number" name="qty" min="1" required className="input-std" />
                </div>
                <button className="btn-primary w-full">Execute Transfer</button>
            </form>
        </div>
    )
}

function RequestReview({ requests }: any) {
    if (requests.length === 0) return <div className="text-center py-10 text-gray-500">No pending requests.</div>

    return (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
                {requests.map((req: any) => (
                    <li key={req.req_id} className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <p className="text-sm font-medium text-blue-600 truncate">{req.item_name}</p>
                                <p className="text-sm text-gray-500">Req by: {req.supervisor_name} ({req.region})</p>
                            </div>
                            <div className="flex items-center">
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                    qty: {req.qty} {req.unit}
                                </span>
                            </div>
                        </div>
                        {/* Action Form */}
                        <form action={processRequest} className="mt-4 flex gap-2 items-end">
                            <input type="hidden" name="req_id" value={req.req_id} />
                            <div className="flex-1">
                                <label className="text-xs text-gray-500">Approve Qty</label>
                                <input type="number" name="qty" defaultValue={req.qty} className="mt-1 block w-24 rounded-md border-gray-300 shadow-sm sm:text-sm border px-2 py-1" />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-gray-500">Notes</label>
                                <input name="notes" placeholder="Optional" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm border px-2 py-1" />
                            </div>
                            <div className="flex gap-2">
                                <button name="action" value="Approve" className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700">
                                    <CheckCircle className="mr-1 h-3 w-3" /> Approve
                                </button>
                                <button name="action" value="Reject" className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700">
                                    <XCircle className="mr-1 h-3 w-3" /> Reject
                                </button>
                            </div>
                        </form>
                    </li>
                ))}
            </ul>
        </div>
    )
}

function SupervisorRequests({ inventory, myRequests, user }: any) {
    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Request Form */}
            <div className="bg-white p-6 rounded-lg border shadow-sm h-fit">
                <h3 className="font-medium text-gray-900 mb-4">Make a Request</h3>
                <form action={createRequest} className="space-y-4">
                    <div>
                        <label className="text-sm">Select Item</label>
                        <select name="item_name" className="input-std">
                            {inventory.map((i: any) => <option key={i.id} value={i.name_en}>{i.name_en}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm">Quantity</label>
                        <input type="number" name="qty" min="1" required className="input-std" />
                    </div>
                    <button className="btn-primary w-full">Send Request</button>
                </form>
            </div>

            {/* My Pending Requests History */}
            <div className="bg-white p-6 rounded-lg border shadow-sm">
                <h3 className="font-medium text-gray-900 mb-4">My Pending Requests</h3>
                {myRequests.length === 0 ? <p className="text-sm text-gray-500">No pending requests.</p> : (
                    <ul className="divide-y divide-gray-200">
                        {myRequests.map((r: any) => (
                            <li key={r.req_id} className="py-3 flex justify-between text-sm">
                                <span>{r.item_name} <span className="text-gray-400">x{r.qty}</span></span>
                                <span className="text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full text-xs">Pending</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}

function StorekeeperIssue({ requests }: any) {
    if (requests.length === 0) return <div className="text-center text-gray-500 py-10">No items approved for issue.</div>

    return (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">For</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {requests.map((req: any) => (
                        <tr key={req.req_id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{req.item_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{req.qty} {req.unit}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{req.supervisor_name} ({req.region})</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <form action={issueRequest}>
                                    <input type="hidden" name="req_id" value={req.req_id} />
                                    <input type="hidden" name="item_name" value={req.item_name} />
                                    <input type="hidden" name="qty" value={req.qty} />
                                    <button className="text-green-600 hover:text-green-900 font-semibold">Issue</button>
                                </form>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )

}


function LogsViewer({ logs }: any) {
    return (
        <div className="bg-white rounded-lg border shadow-sm p-4 overflow-x-auto">
            <table className="min-w-full text-sm text-left">
                <thead><tr className="border-b"><th className="py-2">Date</th><th className="py-2">Item</th><th className="py-2">Action</th><th className="py-2">By</th><th className="py-2">Change</th></tr></thead>
                <tbody>
                    {logs.map((l: any) => (
                        <tr key={l.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-2 text-gray-500">{new Date(l.log_date).toLocaleDateString()}</td>
                            <td className="py-2 font-medium">{l.item_name}</td>
                            <td className="py-2">{l.action_type}</td>
                            <td className="py-2 text-gray-500">{l.action_by}</td>
                            <td className={cn("py-2 font-mono", l.change_amount < 0 ? 'text-red-500' : 'text-green-600')}>
                                {l.change_amount > 0 ? '+' : ''}{l.change_amount}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// Global Styles Helper (Tailwind classes)
// .input-std { @apply mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border px-3 py-2 }
// .btn-primary { @apply flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 }
// Since I can't use @apply in JS, I'll hardcode class strings.
