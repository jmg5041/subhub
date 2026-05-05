'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { AppSidebar } from './app-sidebar'

export function AppShell({
  children,
  schoolName,
  firstName,
  lastName,
  email,
}: {
  children: React.ReactNode
  schoolName: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? email?.[0]?.toUpperCase() ?? ''}`

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar — always visible on desktop, slide-in overlay on mobile */}
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Backdrop for mobile — clicking it closes the sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
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
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{firstName || email}</span>
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
