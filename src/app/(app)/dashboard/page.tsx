/**
 * Dashboard page — the first thing you see after logging in.
 *
 * Shows a real-time summary of today's absences:
 * - Stat cards with live counts from the database
 * - Quick action buttons (Create Absence, Approve, Reconcile)
 * - List of today's pending absences
 *
 * Everything here is read-only — it just shows what's happening today.
 * Use the action buttons to take action.
 */

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { employees, users, schools, absenceReasons, teacherTimeOff, organizations } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import Link from 'next/link'
import {
  CalendarPlus,
  ClipboardList,
  AlertCircle,
  CalendarDays,
  Users,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import { formatDateRangeShort } from '@/lib/date-utils'

// Helper: format '07:30:00' → '7:30 AM'
function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get user profile for the greeting and to find their organization
  const profile = await db.query.users.findFirst({
    where: eq(users.id, user?.id ?? ''),
    with: { school: true },
  })

  const firstName = profile?.firstName || 'there'
  const schoolName = profile?.school?.name || ''
  const orgId = profile?.organizationId

  // Use org's configured timezone — falls back to Pacific if not set
  const orgRecord = orgId
    ? await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
    : null
  const TZ = orgRecord?.timezone ?? 'America/Los_Angeles'

  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const nowTime = new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) // 'HH:MM'
  const localHour = parseInt(new Date().toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }))
  const greeting = localHour < 12 ? 'Good morning' : localHour < 17 ? 'Good afternoon' : 'Good evening'

  // Setup checklist — shown to admin/principal until all steps are complete
  let setupChecklist: { schoolReady: boolean; hasTeachers: boolean; hasSubs: boolean } | null = null
  const isAdminRole = ['admin', 'principal'].includes(profile?.role ?? '')
  if (orgId && isAdminRole) {
    const [firstSchool, firstTeacher, firstSub] = await Promise.all([
      db.query.schools.findFirst({ where: eq(schools.organizationId, orgId) }),
      db.query.users.findFirst({ where: and(eq(users.organizationId, orgId), eq(users.role, 'teacher')) }),
      db.query.users.findFirst({ where: and(eq(users.organizationId, orgId), eq(users.role, 'substitute')) }),
    ])
    const checklist = {
      schoolReady: !!(firstSchool?.phone || firstSchool?.address),
      hasTeachers: !!firstTeacher,
      hasSubs: !!firstSub,
    }
    // Only show if at least one step is incomplete
    if (!checklist.schoolReady || !checklist.hasTeachers || !checklist.hasSubs) {
      setupChecklist = checklist
    }
  }

  // Single query for all org absences — split in JS for today/upcoming
  const allAbsences = orgId
    ? await db
        .select({
          id: teacherTimeOff.id,
          startDate: teacherTimeOff.startDate,
          endDate: teacherTimeOff.endDate,
          startTime: teacherTimeOff.startTime,
          endTime: teacherTimeOff.endTime,
          approvalStatus: teacherTimeOff.approvalStatus,
          substituteRequired: teacherTimeOff.substituteRequired,
          subOutreachStatus: teacherTimeOff.subOutreachStatus,
          teacherFirstName: users.firstName,
          teacherLastName: users.lastName,
          schoolName: schools.name,
          reasonName: absenceReasons.name,
        })
        .from(teacherTimeOff)
        .innerJoin(employees, eq(teacherTimeOff.employeeId, employees.id))
        .innerJoin(users, eq(employees.userId, users.id))
        .innerJoin(schools, eq(teacherTimeOff.schoolId, schools.id))
        .leftJoin(absenceReasons, eq(teacherTimeOff.reasonId, absenceReasons.id))
        .where(and(
          eq(teacherTimeOff.organizationId, orgId),
          isNull(teacherTimeOff.completedAt),
        ))
    : []

  // "Today" = absence spans today (started on or before today, ends on or after today)
  // Cancelled (denied) absences are excluded from all views
  // Filled absences are hidden once their end time has passed — no need to see them after the fact
  const todayAbsences = allAbsences.filter(a => {
    const effectiveEnd = a.endDate ?? a.startDate
    if (a.startDate > today || effectiveEnd < today || a.approvalStatus === 'denied') return false
    const isCovered = a.subOutreachStatus === 'filled' || !a.substituteRequired
    if (isCovered && a.endTime.slice(0, 5) <= nowTime) return false
    return true
  })
  // "Upcoming" = absence hasn't started yet
  const upcomingAbsences = allAbsences.filter(a => a.startDate > today && a.approvalStatus !== 'denied')

  function statPair(filterFn: (a: typeof allAbsences[0]) => boolean) {
    return {
      today: todayAbsences.filter(filterFn).length,
      upcoming: upcomingAbsences.filter(filterFn).length,
    }
  }

  const stats = {
    total:        statPair(() => true),
    waitingOnSub: statPair(a => a.approvalStatus === 'approved' && !!a.substituteRequired && a.subOutreachStatus !== 'filled'),
    subFound:     statPair(a => a.subOutreachStatus === 'filled'),
    coveredByAdmin: statPair(a => a.approvalStatus === 'approved' && !a.substituteRequired && a.subOutreachStatus !== 'filled'),
  }


  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}, {firstName}
        </h1>
        <p className="text-gray-500">
          {schoolName} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ })}
        </p>
      </div>

      {/* Setup checklist — visible until all 3 steps are done */}
      {setupChecklist && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-blue-900">Get started with SubHub</h2>
              <p className="text-sm text-blue-600 mt-0.5">Complete these steps to start managing absences</p>
            </div>
            <span className="text-sm font-medium text-blue-700 flex-shrink-0">
              {[setupChecklist.schoolReady, setupChecklist.hasTeachers, setupChecklist.hasSubs].filter(Boolean).length} of 3 complete
            </span>
          </div>
          <div className="space-y-2">
            <SetupItem
              done={setupChecklist.schoolReady}
              href="/admin/schools"
              label="Configure your school"
              description="Add a phone number or address so substitutes know how to reach you"
            />
            <SetupItem
              done={setupChecklist.hasTeachers}
              href="/admin/users"
              label="Invite your teachers"
              description="Teachers can submit absence requests once they have an account"
            />
            <SetupItem
              done={setupChecklist.hasSubs}
              href="/admin/users"
              label="Add substitutes"
              description="Substitutes receive job notifications when absences need coverage"
            />
          </div>
        </div>
      )}

      {/* Stat cards — live counts from the database */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Absences" todayValue={stats.total.today} upcomingValue={stats.total.upcoming} color="blue" />
        <StatCard title="Waiting on Sub" todayValue={stats.waitingOnSub.today} upcomingValue={stats.waitingOnSub.upcoming} color="orange" />
        <StatCard title="Sub Found" todayValue={stats.subFound.today} upcomingValue={stats.subFound.upcoming} color="green" />
        <StatCard title="Covered by Admin/Staff" todayValue={stats.coveredByAdmin.today} upcomingValue={stats.coveredByAdmin.upcoming} color="gray" />
      </div>

      {/* Quick action buttons */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/absences/create"
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
        >
          <CalendarPlus className="h-8 w-8 text-blue-600" />
          <div>
            <p className="font-semibold text-gray-900">Create Absence</p>
            <p className="text-sm text-gray-500">Report a teacher absence</p>
          </div>
        </Link>

        <Link
          href="/absences/reconcile"
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-purple-300 hover:bg-purple-50"
        >
          <ClipboardList className="h-8 w-8 text-purple-600" />
          <div>
            <p className="font-semibold text-gray-900">Reconcile</p>
            <p className="text-sm text-gray-500">Confirm sub assignments</p>
          </div>
        </Link>

        <Link
          href="/absences/find-sub"
          className="relative flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50"
        >
          <Users className="h-8 w-8 text-orange-500" />
          <div>
            <p className="font-semibold text-gray-900">Unfilled</p>
            <p className="text-sm text-gray-500">Need a sub assigned</p>
          </div>
          {(stats.waitingOnSub.today + stats.waitingOnSub.upcoming) > 0 && (
            <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
              {stats.waitingOnSub.today + stats.waitingOnSub.upcoming}
            </span>
          )}
        </Link>
      </div>

      {/* Today's absences table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Today&apos;s Absences</h2>
            <p className="text-sm text-gray-500">All reported absences for today</p>
          </div>
        </div>

        {todayAbsences.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">No absences today. Create one to get started!</p>
            <Link
              href="/absences/create"
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Create Absence
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {todayAbsences.map((absence) => (
              <Link key={absence.id} href={`/absences/find-sub/${absence.id}`} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors cursor-pointer">
                {/* Status dot */}
                <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-green-500" />

                {/* Teacher name */}
                <p className="w-40 flex-shrink-0 font-medium text-gray-900">
                  {absence.teacherFirstName} {absence.teacherLastName}
                </p>

                {/* School */}
                <p className="w-48 flex-shrink-0 text-sm text-gray-500 truncate">{absence.schoolName}</p>

                {/* Time */}
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatTime(absence.startTime)} – {formatTime(absence.endTime)}
                </div>

                {/* Reason */}
                {absence.reasonName && (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {absence.reasonName}
                  </span>
                )}

                {/* Right-side badge — sub outreach status only */}
                <div className="ml-auto flex-shrink-0">
                  {absence.subOutreachStatus === 'filled' && absence.substituteRequired ? (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      Filled by Sub
                    </span>
                  ) : !absence.substituteRequired ? (
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      Filled by Staff
                    </span>
                  ) : (
                    <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                      Find Sub →
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming absences table */}
      {upcomingAbsences.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Upcoming Absences</h2>
              <p className="text-sm text-gray-500">Scheduled absences for future dates</p>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {upcomingAbsences.map((absence) => (
              <Link key={absence.id} href={`/absences/find-sub/${absence.id}`} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors cursor-pointer">
                {/* Status dot */}
                <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-green-500" />

                {/* Teacher name */}
                <p className="w-40 flex-shrink-0 font-medium text-gray-900">
                  {absence.teacherFirstName} {absence.teacherLastName}
                </p>

                {/* School */}
                <p className="w-48 flex-shrink-0 text-sm text-gray-500 truncate">{absence.schoolName}</p>

                {/* Time */}
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatTime(absence.startTime)} – {formatTime(absence.endTime)}
                </div>

                {/* Reason */}
                {absence.reasonName && (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {absence.reasonName}
                  </span>
                )}

                {/* Date — shown in upcoming but not today */}
                <span className="text-sm text-gray-500">{formatDateRangeShort(absence.startDate, absence.endDate)}</span>

                {/* Right-side badge — sub outreach status only */}
                <div className="ml-auto flex-shrink-0">
                  {absence.subOutreachStatus === 'filled' && absence.substituteRequired ? (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      Filled by Sub
                    </span>
                  ) : !absence.substituteRequired ? (
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      Filled by Staff
                    </span>
                  ) : (
                    <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                      Find Sub →
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  title,
  todayValue,
  upcomingValue,
  color,
}: {
  title: string
  todayValue: number
  upcomingValue: number
  color: 'blue' | 'yellow' | 'green' | 'orange' | 'gray'
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  }

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-3">{title}</p>
      <div className="flex items-end gap-1">
        <div className="flex-1">
          <p className="text-3xl font-bold leading-none">{todayValue}</p>
          <p className="text-xs opacity-60 mt-1">today</p>
        </div>
        <div className="text-3xl font-thin opacity-25 pb-5">/</div>
        <div className="flex-1 text-right">
          <p className="text-3xl font-bold leading-none">{upcomingValue}</p>
          <p className="text-xs opacity-60 mt-1">upcoming</p>
        </div>
      </div>
    </div>
  )
}

function SetupItem({ done, href, label, description }: {
  done: boolean
  href: string
  label: string
  description: string
}) {
  return (
    <Link
      href={href}
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        done
          ? 'border-green-200 bg-green-50 opacity-60 pointer-events-none'
          : 'border-blue-200 bg-white hover:bg-blue-50'
      }`}
    >
      {done
        ? <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
        : <Circle className="h-5 w-5 flex-shrink-0 text-blue-400 mt-0.5" />
      }
      <div className="min-w-0">
        <p className={`text-sm font-medium ${done ? 'text-green-800 line-through' : 'text-gray-900'}`}>{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      {!done && <span className="ml-auto text-xs text-blue-600 font-medium flex-shrink-0 self-center">Go →</span>}
    </Link>
  )
}
