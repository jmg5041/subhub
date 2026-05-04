/**
 * Substitute portal layout — wraps all /sub/dashboard and /sub/availability pages.
 * Note: /sub/jobs/[token] is public (no login) so it's NOT in this route group.
 */

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Home, Calendar, LogOut } from 'lucide-react'

export default async function SubLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    with: { school: true },
  })

  if (!profile) redirect('/auth/login')

  if (profile.role !== 'substitute') {
    redirect(profile.role === 'teacher' ? '/teacher' : '/dashboard')
  }

  const initials = `${profile.firstName[0]}${profile.lastName[0]}`

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-4 py-5 border-b border-gray-100">
          <div className="text-lg font-bold text-blue-600">SubHub</div>
          <div className="text-xs text-gray-400 mt-0.5">Substitute Portal</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link href="/sub/dashboard" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">
            <Home className="h-4 w-4" /> Home
          </Link>
          <Link href="/sub/availability" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">
            <Calendar className="h-4 w-4" /> My Availability
          </Link>
        </nav>
        <div className="px-4 py-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{profile.firstName} {profile.lastName}</div>
              <div className="text-xs text-gray-400">Substitute</div>
            </div>
          </div>
          <form action="/auth/signout" method="POST">
            <button type="submit" className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  )
}
