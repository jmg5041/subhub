import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getMyAssignments, getMyPendingTokens } from '../../actions'
import { Calendar, CheckCircle, Clock, MapPin } from 'lucide-react'

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function formatDateLong(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
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
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

  const [assignments, pendingTokens] = await Promise.all([
    getMyAssignments(),
    getMyPendingTokens(),
  ])

  const upcoming = assignments.filter(a => a.date >= today)
  const past = assignments.filter(a => a.date < today)

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting}, {profile.firstName}</h1>
        <p className="text-gray-500 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-center">
          <div className="text-2xl font-bold text-orange-700">{pendingTokens.length}</div>
          <div className="text-xs text-orange-600 mt-0.5">Open requests</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{upcoming.length}</div>
          <div className="text-xs text-blue-600 mt-0.5">Upcoming jobs</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-gray-700">{past.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Completed</div>
        </div>
      </div>

      {/* Pending requests — jobs they haven't responded to yet */}
      {pendingTokens.length > 0 && (
        <div className="rounded-lg border border-orange-200 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-600" />
            <span className="font-semibold text-orange-900 text-sm">Requests Awaiting Your Response</span>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingTokens.map(t => (
              <div key={t.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">{t.teacherTimeOff.school.name}</div>
                  <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-3">
                    <span>{formatDateLong(t.teacherTimeOff.date)}</span>
                    <span className="text-gray-300">·</span>
                    <span>{formatTime(t.teacherTimeOff.startTime)} – {formatTime(t.teacherTimeOff.endTime)}</span>
                  </div>
                </div>
                <Link
                  href={`/sub/jobs/${t.token}`}
                  className="flex-shrink-0 bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Respond
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Set availability */}
      <Link
        href="/sub/availability"
        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors"
      >
        <Calendar className="h-5 w-5 text-orange-500 flex-shrink-0" />
        <div>
          <div className="font-medium text-gray-900">Set My Availability</div>
          <div className="text-sm text-gray-500">Mark dates you&apos;re not available to sub</div>
        </div>
      </Link>

      {/* Upcoming assignments */}
      {upcoming.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-900 text-sm">Upcoming Assignments</span>
          </div>
          <div className="divide-y divide-gray-100">
            {upcoming.map(a => (
              <div key={a.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">{formatDate(a.date)}</div>
                    <div className="text-sm text-blue-700 font-medium mt-0.5">
                      {formatTime(a.startTime)} – {formatTime(a.endTime)}
                    </div>
                    {a.school && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        {a.school.name}
                      </div>
                    )}
                    {a.timeOffLinks.map(link => link.timeOff && (
                      <div key={link.timeOff.id} className="text-xs text-gray-400 mt-1">
                        Covering: {link.timeOff.employee?.user?.firstName} {link.timeOff.employee?.user?.lastName}
                        {link.timeOff.notesToSub && (
                          <span> · {link.timeOff.notesToSub.slice(0, 100)}{link.timeOff.notesToSub.length > 100 ? '…' : ''}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <span className="flex-shrink-0 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                    {a.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past assignments */}
      {past.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-900 text-sm">Recent Completed</span>
          </div>
          <div className="divide-y divide-gray-100">
            {past.slice(0, 5).map(a => (
              <div key={a.id} className="px-5 py-3 flex items-center gap-4">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700">{formatDate(a.date)}</div>
                  {a.school && <div className="text-xs text-gray-400 truncate">{a.school.name}</div>}
                </div>
                <div className="text-xs text-gray-400">{formatTime(a.startTime)} – {formatTime(a.endTime)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {assignments.length === 0 && pendingTokens.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-10 text-center text-gray-500">
          No assignments yet. When an admin sends you a request, it will appear here.
        </div>
      )}
    </div>
  )
}
