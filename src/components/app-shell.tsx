'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { AppSidebar } from './app-sidebar'

export function AppShell({
  children,
  schoolName,
  firstName,
  lastName,
  email,
  role,
  avatarUrl,
  pendingSubCount,
  isPlatformAdmin,
}: {
  children: React.ReactNode
  schoolName: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  role: string | null
  avatarUrl?: string | null
  pendingSubCount?: number
  isPlatformAdmin?: boolean
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? email?.[0]?.toUpperCase() ?? ''}`

  // Only admin/principal/staff have a /profile page; teachers and subs have their own
  const profileHref =
    role === 'teacher' ? '/teacher/profile' :
    role === 'substitute' ? '/sub/profile' :
    '/profile'

  return (
    <div className="flex h-[100dvh] bg-gray-50 print:block print:h-auto">
      {/* Sidebar — always visible on desktop, slide-in overlay on mobile */}
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={role} pendingSubCount={pendingSubCount} isPlatformAdmin={isPlatformAdmin} />

      {/* Backdrop for mobile — clicking it closes the sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0 print:block print:overflow-visible">
        {/* Top bar — hidden when printing so reports print clean */}
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 print:hidden">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            {schoolName && (
              <span className="text-sm text-gray-500 truncate">{schoolName}</span>
            )}
          </div>
          <Link href={profileHref} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <span className="text-sm text-gray-500 hidden sm:block">{firstName || email}</span>
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" width={32} height={32} className="object-cover w-full h-full" />
              ) : (
                initials
              )}
            </div>
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 print:overflow-visible print:h-auto print:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
