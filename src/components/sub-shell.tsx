'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Briefcase, Calendar, HelpCircle, Home, LogOut, Menu, School, User, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/sub/dashboard', label: 'Home', icon: Home },
  { href: '/sub/availability', label: 'My Availability', icon: Calendar },
  { href: '/sub/past-jobs', label: 'Past Jobs', icon: Briefcase },
  { href: '/sub/schools', label: 'Find Schools', icon: School },
  { href: '/sub/profile', label: 'My Profile', icon: User },
]

export function SubShell({
  children,
  firstName,
  lastName,
  initials,
  avatarUrl,
}: {
  children: React.ReactNode
  firstName: string
  lastName: string
  initials: string
  avatarUrl: string | null
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const Sidebar = (
    <aside className={cn(
      'flex h-[100dvh] w-56 flex-shrink-0 flex-col border-r border-gray-200 bg-white',
      'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out md:transition-none',
      'md:relative md:translate-x-0',
      sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
    )}>
      <div className="flex items-center justify-between px-4 py-5 border-b border-gray-100">
        <Link href="/sub/dashboard" onClick={() => setSidebarOpen(false)} className="hover:opacity-80 transition-opacity">
          <div className="text-lg font-bold text-blue-600">SubHub</div>
          <div className="text-xs text-gray-400 mt-0.5">Substitute Portal</div>
        </Link>
        <button onClick={() => setSidebarOpen(false)} className="rounded-md p-1 text-gray-400 hover:text-gray-600 md:hidden">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/sub/dashboard' && pathname?.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-orange-50 text-orange-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-100 space-y-3">
        <div className="flex items-center gap-2.5">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" width={32} height={32} className="rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{firstName} {lastName}</div>
            <div className="text-xs text-gray-400">Substitute</div>
          </div>
        </div>
        <Link href="/sub/help" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600">
          <HelpCircle className="h-3.5 w-3.5" /> Help
        </Link>
        <button onClick={handleSignOut} className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600">
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-[100dvh] bg-gray-50">
      {Sidebar}

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-blue-600">SubHub</span>
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" width={32} height={32} className="rounded-full object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
