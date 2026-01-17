'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    Package,
    Users,
    LogOut,
    Menu,
} from 'lucide-react'
import { useState } from 'react'
import { logout } from '@/app/actions/auth'

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Warehouse', href: '/warehouse', icon: Package },
    { name: 'Manpower', href: '/manpower', icon: Users },
]

export function Sidebar() {
    const pathname = usePathname()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                type="button"
                className="fixed top-4 left-4 z-50 rounded-md bg-white p-2 text-gray-400 shadow-md lg:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
                <span className="sr-only">Open sidebar</span>
                <Menu className="h-6 w-6" aria-hidden="true" />
            </button>

            {/* Sidebar for Desktop & Mobile Overlay */}
            <div
                className={cn(
                    "fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white transition-transform duration-300 ease-in-out lg:translate-x-0",
                    isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="flex h-16 shrink-0 items-center bg-gray-900 px-6">
                    <h1 className="text-xl font-bold tracking-tight text-white">NSTC App</h1>
                </div>

                <nav className="flex flex-1 flex-col px-4 py-4 space-y-1">
                    {navigation.map((item) => {
                        const isActive = pathname.startsWith(item.href)
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    isActive
                                        ? 'bg-gray-800 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800',
                                    'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                )}
                            >
                                <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                                {item.name}
                            </Link>
                        )
                    })}

                    <div className="mt-auto pt-8">
                        <form action={logout}>
                            <button
                                type="submit"
                                className="flex w-full gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-gray-400 hover:bg-gray-800 hover:text-white"
                            >
                                <LogOut className="h-6 w-6 shrink-0" aria-hidden="true" />
                                Sign out
                            </button>
                        </form>
                    </div>
                </nav>
            </div>

            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}
        </>
    )
}
