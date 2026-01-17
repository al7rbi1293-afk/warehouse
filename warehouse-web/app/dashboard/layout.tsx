import { Sidebar } from '@/components/Sidebar'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await getSession()
    if (!session) redirect('/login')

    return (
        <div className="min-h-screen bg-gray-50">
            <Sidebar />
            <div className="lg:pl-64">
                <main className="py-10 px-4 sm:px-6 lg:px-8">
                    {children}
                </main>
            </div>
        </div>
    )
}
