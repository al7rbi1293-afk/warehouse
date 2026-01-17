import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Users,
    ClipboardList,
    AlertTriangle,
    Package,
} from 'lucide-react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
} from 'recharts'

// --- Components ---
// Minimal Card Component to avoid Shadcn dependency hell for now
function StatsCard({ title, value, icon: Icon, subtext, color = "text-blue-600" }: any) {
    return (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className={`p-3 bg-gray-100 rounded-full ${color}`}>
                    <Icon className="h-6 w-6" />
                </div>
            </div>
            {subtext && <p className="mt-2 text-xs text-gray-500">{subtext}</p>}
        </div>
    )
}

export default async function DashboardPage() {
    const session = await getSession()

    // 1. Fetch Metrics
    // Workers
    const { count: workerCount } = await supabase.from('workers').select('*', { count: 'exact', head: true }).eq('status', 'Active')

    // Attendance Today
    const today = new Date().toISOString().split('T')[0]
    const { data: attendance } = await supabase.from('attendance').select('status').eq('date', today)
    const presentCount = attendance?.filter(a => a.status === 'Present').length || 0
    const attRate = workerCount ? Math.round((presentCount / workerCount) * 100) : 0

    // Pending Requests
    const { count: pendingCount } = await supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'Pending')

    // Low Stock (< 10)
    const { count: lowStockCount } = await supabase.from('inventory').select('*', { count: 'exact', head: true }).lt('qty', 10)

    // 2. Fetch Chart Data
    // Workers by Region
    const { data: workers } = await supabase.from('workers').select('region').eq('status', 'Active')
    const regionMap = new Map()
    workers?.forEach(w => {
        const r = w.region || 'Unknown'
        regionMap.set(r, (regionMap.get(r) || 0) + 1)
    })
    const regionData = Array.from(regionMap.entries()).map(([name, value]) => ({ name, value }))
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    // Stock Value (Category)
    const { data: stock } = await supabase.from('inventory').select('category, qty').eq('location', 'NSTC')
    const categoryMap = new Map()
    stock?.forEach(s => {
        const c = s.category || 'Other'
        categoryMap.set(c, (categoryMap.get(c) || 0) + (s.qty || 0))
    })
    const stockData = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }))


    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h2>
                <p className="text-gray-500">Welcome back, {session?.user.name}</p>
            </div>

            {/* Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Active Workers"
                    value={workerCount || 0}
                    icon={Users}
                    color="text-blue-600"
                />
                <StatsCard
                    title="Attendance Rate"
                    value={`${attRate}%`}
                    subtext={`${presentCount} / ${workerCount} Present Today`}
                    icon={ClipboardList}
                    color="text-green-600"
                />
                <StatsCard
                    title="Pending Requests"
                    value={pendingCount || 0}
                    icon={Package}
                    color="text-orange-600"
                />
                <StatsCard
                    title="Low Stock Items"
                    value={lowStockCount || 0}
                    icon={AlertTriangle}
                    color="text-red-600"
                />
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Pie Chart */}
                <div className="col-span-4 rounded-lg border bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-lg font-medium">Workers by Region</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={regionData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                    label
                                >
                                    {regionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Bar Chart */}
                <div className="col-span-3 rounded-lg border bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-lg font-medium">NSTC Stock by Category</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stockData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    )
}
