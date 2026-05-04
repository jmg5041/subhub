/**
 * Teacher dashboard — landing page after login for teachers.
 * Shows their upcoming absences and a quick link to submit a new request.
 */

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarPlus } from 'lucide-react'
import { getMyAbsences } from './actions'

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Pending approval',
  not_needed: 'No sub needed',
  sent: 'Subs notified',
  filled: 'Sub assigned',
}
const STATUS_COLOR: Record<string, string> = {
  not_started: 'bg-yellow-100 text-yellow-700',
  not_needed: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  filled: 'bg-green-100 text-green-700',
}

export default async function TeacherDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile) redirect('/auth/login')

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const absences = await getMyAbsences()
  const today = new Date().toISOString().split('T')[0]
  const upcoming = absences.filter(a => a.date >= today).slice(0, 5)
  const pending = absences.filter(a => a.approvalStatus === 'unapproved').length

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting}, {profile.firstName}</h1>
        <p className="text-gray-500 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-gray-900">{absences.length}</div>
          <div className="text-sm text-gray-500">Total requests</div>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="text-2xl font-bold text-yellow-700">{pending}</div>
          <div className="text-sm text-yellow-600">Pending approval</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="text-2xl font-bold text-green-700">
            {absences.filter(a => a.subOutreachStatus === 'filled').length}
          </div>
          <div className="text-sm text-green-600">Sub assigned</div>
        </div>
      </div>

      {/* Quick action */}
      <Link
        href="/teacher/absences/new"
        className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 hover:bg-blue-100 transition-colors"
      >
        <CalendarPlus className="h-6 w-6 text-blue-600" />
        <div>
          <div className="font-semibold text-blue-900">Submit Absence Request</div>
          <div className="text-sm text-blue-600">Report an upcoming absence</div>
        </div>
      </Link>

      {/* Upcoming absences */}
      {upcoming.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Upcoming Absences</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {upcoming.map(a => {
              const status = a.subOutreachStatus ?? 'not_started'
              const approval = a.approvalStatus ?? 'unapproved'
              const displayStatus = approval === 'unapproved' ? 'not_started' : status
              return (
                <div key={a.id} className="flex items-center gap-4 px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{formatDate(a.date)}</div>
                    <div className="text-xs text-gray-400">{formatTime(a.startTime)} – {formatTime(a.endTime)}</div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[displayStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                    {approval === 'unapproved' ? 'Pending approval' : STATUS_LABEL[status]}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="px-6 py-3 border-t border-gray-100">
            <Link href="/teacher/absences" className="text-sm text-blue-600 hover:underline">
              View all absences →
            </Link>
          </div>
        </div>
      )}

      {upcoming.length === 0 && absences.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-10 text-center text-gray-500">
          No absence requests yet.{' '}
          <Link href="/teacher/absences/new" className="text-blue-600 hover:underline">Submit your first one.</Link>
        </div>
      )}
    </div>
  )
}
