/**
 * Substitute dashboard — shows their upcoming and past assignments.
 */

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getMyAssignments } from '../../actions'
import { Calendar } from 'lucide-react'

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default async function SubDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile) redirect('/auth/login')

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toISOString().split('T')[0]

  const assignments = await getMyAssignments()
  const upcoming = assignments.filter(a => a.date >= today)
  const past = assignments.filter(a => a.date < today).slice(0, 5)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting}, {profile.firstName}</h1>
        <p className="text-gray-500 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="text-2xl font-bold text-blue-700">{upcoming.length}</div>
          <div className="text-sm text-blue-600">Upcoming jobs</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-gray-700">{assignments.length}</div>
          <div className="text-sm text-gray-500">Total completed</div>
        </div>
      </div>

      <Link
        href="/sub/availability"
        className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 hover:bg-orange-100 transition-colors"
      >
        <Calendar className="h-6 w-6 text-orange-500" />
        <div>
          <div className="font-semibold text-orange-900">Set My Availability</div>
          <div className="text-sm text-orange-600">Mark dates you&apos;re not available</div>
        </div>
      </Link>

      {upcoming.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="px-6 py-4 border-b border-gray-100 font-semibold text-gray-900">Upcoming Assignments</div>
          <div className="divide-y divide-gray-100">
            {upcoming.map(a => (
              <div key={a.id} className="px-6 py-3">
                <div className="font-medium text-sm text-gray-900">{formatDate(a.date)}</div>
                <div className="text-xs text-gray-500">{a.school?.name} · {formatTime(a.startTime)} – {formatTime(a.endTime)}</div>
                {a.timeOffLinks.map(link => link.timeOff && (
                  <div key={link.timeOff.id} className="text-xs text-gray-400 mt-0.5">
                    Covering: {link.timeOff.employee?.user?.firstName} {link.timeOff.employee?.user?.lastName}
                    {link.timeOff.notesToSub && <> · {link.timeOff.notesToSub.slice(0, 80)}{link.timeOff.notesToSub.length > 80 ? '...' : ''}</>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="px-6 py-4 border-b border-gray-100 font-semibold text-gray-900">Recent Past Assignments</div>
          <div className="divide-y divide-gray-100">
            {past.map(a => (
              <div key={a.id} className="px-6 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700">{formatDate(a.date)} · {a.school?.name}</div>
                  <div className="text-xs text-gray-400">{formatTime(a.startTime)} – {formatTime(a.endTime)}</div>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {assignments.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-10 text-center text-gray-500">
          No assignments yet. When an admin assigns you to a job, it will appear here.
        </div>
      )}
    </div>
  )
}
