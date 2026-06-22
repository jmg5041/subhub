/**
 * Substitute dashboard — landing page after sub login.
 *
 * Sections:
 *   1. Greeting + today's date
 *   2. Open requests (jobs to respond to)
 *   3. Upcoming confirmed assignments
 *   4. Past jobs summary — grouped by school with total hours
 *   5. Set availability link
 */

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, organizations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getMyAssignments, getMyPendingTokens } from '../../actions'
import { getEffectiveUserId } from '@/lib/impersonation'
import { Calendar, Clock, MapPin, ChevronRight } from 'lucide-react'
import { formatDateRange } from '@/lib/date-utils'
import AutoRefresh from './AutoRefresh'

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

  const effectiveUserId = await getEffectiveUserId(user.id)
  const profile = await db.query.users.findFirst({ where: eq(users.id, effectiveUserId) })
  if (!profile) redirect('/auth/login')

  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, profile.organizationId) })
  const TZ = org?.timezone ?? 'America/Los_Angeles'
  const today   = new Date().toLocaleDateString('en-CA', { timeZone: TZ })  // 'YYYY-MM-DD'
  const nowTime = new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) // 'HH:MM'
  const hourPT  = parseInt(new Date().toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }))
  const greeting = hourPT < 12 ? 'Good morning' : hourPT < 17 ? 'Good afternoon' : 'Good evening'

  const [assignments, pendingTokens] = await Promise.all([
    getMyAssignments(),
    getMyPendingTokens(),
  ])

  // A job is "past" if its date is before today, OR it's today but the end time has already passed
  const upcoming = assignments.filter(a => {
    if (a.date > today) return true
    if (a.date < today) return false
    return a.endTime.slice(0, 5) > nowTime  // same day — still upcoming if end time hasn't passed
  })
  const past = assignments.filter(a => {
    if (a.date < today) return true
    if (a.date > today) return false
    return a.endTime.slice(0, 5) <= nowTime  // same day — past if end time has passed
  })

  // ── Per-school summary for past jobs ──
  type SchoolSummary = {
    schoolId: string
    schoolName: string
    jobCount: number
    totalHours: number
  }
  const schoolMap = new Map<string, SchoolSummary>()
  for (const a of past) {
    const existing = schoolMap.get(a.schoolId)
    const hours = Number(a.totalHours ?? 0)
    if (existing) {
      existing.jobCount++
      existing.totalHours += hours
    } else {
      schoolMap.set(a.schoolId, {
        schoolId: a.schoolId,
        schoolName: a.school?.name ?? 'Unknown School',
        jobCount: 1,
        totalHours: hours,
      })
    }
  }
  const schoolSummaries = Array.from(schoolMap.values())
    .sort((a, b) => b.totalHours - a.totalHours)

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting}, {profile.firstName}</h1>
        <p className="text-gray-500 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ })}
        </p>
      </div>

      {/* Bounced email warning */}
      {profile.emailBounced && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">Your email address may be incorrect</p>
          <p className="text-sm text-red-700 mt-0.5">
            A recent email to <span className="font-medium">{profile.email}</span> failed to deliver.
            You won&apos;t receive job notifications until your email is corrected.
            Contact your school administrator to update it.
          </p>
        </div>
      )}

      {/* Profile completion nudge — shown until phone is on file */}
      {!profile.phone && (
        <Link
          href="/sub/profile"
          className="flex items-center justify-between gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 hover:bg-yellow-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-yellow-600 font-bold text-lg leading-none">!</span>
            <p className="text-sm font-medium text-yellow-800">Complete your profile to receive job notifications</p>
          </div>
          <span className="text-xs text-yellow-700 font-medium flex-shrink-0">Add phone →</span>
        </Link>
      )}

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
          <div className="text-xs text-gray-500 mt-0.5">Jobs completed</div>
        </div>
      </div>

      {/* Auto-refreshes every 30s so filled jobs disappear without a manual reload */}
      {pendingTokens.length > 0 && <AutoRefresh />}

      {/* Open requests — jobs awaiting response */}
      {pendingTokens.length > 0 && (
        <div className="rounded-lg border border-orange-200 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-orange-50 border-b border-orange-100">
            <span className="font-semibold text-orange-900 text-sm">
              {pendingTokens.length === 1 ? '1 Request Awaiting Your Response' : `${pendingTokens.length} Requests Awaiting Your Response`}
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingTokens.map(t => (
              <div key={t.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">{t.teacherTimeOff.school.name}</div>
                  {t.teacherTimeOff.employee?.user && (
                    <div className="text-sm text-gray-600 mt-0.5">
                      Covering for {t.teacherTimeOff.employee.user.firstName} {t.teacherTimeOff.employee.user.lastName}
                    </div>
                  )}
                  <div className="text-sm text-gray-500 mt-0.5">
                    {formatDateLong(t.teacherTimeOff.startDate)}
                    {' · '}
                    {formatTime(t.teacherTimeOff.startTime)} – {formatTime(t.teacherTimeOff.endTime)}
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
        <ChevronRight className="h-4 w-4 text-gray-400 ml-auto" />
      </Link>

      {/* Upcoming assignments */}
      {upcoming.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-900 text-sm">Upcoming Jobs</span>
            <span className="text-xs text-blue-600 font-medium">{upcoming.length} scheduled</span>
          </div>
          <div className="divide-y divide-gray-100">
            {upcoming.map(a => {
              const isToday = a.date === today
              const timeOffLinks = a.timeOffLinks ?? []
              const primaryTimeOff = timeOffLinks[0]?.timeOff
              const startDate = primaryTimeOff?.startDate ?? a.date
              const endDate = primaryTimeOff?.endDate ?? null
              const teacher = primaryTimeOff?.employee?.user
              const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : null
              return (
                <Link
                  key={a.id}
                  href={`/sub/dashboard/jobs/${a.id}`}
                  className="block px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900">{a.school?.name}</div>
                        {isToday && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            Today
                          </span>
                        )}
                      </div>
                      {teacherName && (
                        <div className="text-sm text-gray-600 mt-0.5">Covering for {teacherName}</div>
                      )}
                      <div className="text-sm text-gray-500 mt-0.5">
                        {formatDateRange(startDate, endDate)}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-blue-700 font-medium mt-0.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTime(a.startTime)} – {formatTime(a.endTime)}
                      </div>
                      {a.school?.address && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                          <MapPin className="h-3 w-3" />
                          {a.school.address}{a.school.city && `, ${a.school.city}`}
                        </div>
                      )}
                      {/* Show teacher notes preview if any */}
                      {timeOffLinks.some(l => l.timeOff?.notesToSub) && (
                        <div className="text-xs text-gray-400 mt-1 italic">
                          Notes attached — tap to view
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Past jobs by school */}
      {past.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900 text-sm">Hours Worked by School</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  All-time totals · {past.length} job{past.length !== 1 ? 's' : ''} completed
                </div>
              </div>
              <Link href="/sub/past-jobs" className="text-xs text-blue-500 hover:underline">View all</Link>
            </div>
          </div>

          {/* Per-school summary rows */}
          <div className="divide-y divide-gray-100">
            {schoolSummaries.map(s => (
              <Link
                key={s.schoolId}
                href={`/sub/schools/${s.schoolId}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{s.schoolName}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {s.jobCount} job{s.jobCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-semibold text-gray-800">
                    {s.totalHours.toFixed(1)} hrs
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </Link>
            ))}
          </div>

          {/* Recent individual jobs */}
          <div className="border-t border-gray-100">
            <div className="px-5 py-2 bg-gray-50 text-xs text-gray-400 font-medium uppercase tracking-wide">
              Recent Jobs
            </div>
            <div className="divide-y divide-gray-100">
              {past.slice(0, 8).map(a => (
                <Link
                  key={a.id}
                  href={`/sub/dashboard/jobs/${a.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-700">{formatDate(a.date)}</div>
                    <div className="text-xs text-gray-400 truncate">{a.school?.name}</div>
                  </div>
                  <div className="text-right flex-shrink-0 text-xs text-gray-500">
                    {Number(a.totalHours) > 0 ? `${Number(a.totalHours).toFixed(1)} hrs` : formatTime(a.startTime) + ' – ' + formatTime(a.endTime)}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                </Link>
              ))}
            </div>
            {past.length > 8 && (
              <div className="px-5 py-3 border-t border-gray-100 text-center">
                <span className="text-xs text-gray-400">Showing 8 of {past.length} past jobs</span>
              </div>
            )}
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
