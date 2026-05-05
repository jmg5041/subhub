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
import { employees, users, schools, absenceReasons, teacherTimeOff } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import Link from 'next/link'
import {
  CalendarPlus,
  ClipboardCheck,
  ClipboardList,
  AlertCircle,
  CalendarDays,
  Users,
} from 'lucide-react'

// Helper: format 'YYYY-MM-DD' → 'Mon, May 3'
function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

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

  // Today's date in Pacific time — server runs UTC so toISOString() would give tomorrow after 5 PM PT
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

  // Greeting based on time of day
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const absenceSelect = {
    id: teacherTimeOff.id,
    date: teacherTimeOff.date,
    startTime: teacherTimeOff.startTime,
    endTime: teacherTimeOff.endTime,
    approvalStatus: teacherTimeOff.approvalStatus,
    substituteRequired: teacherTimeOff.substituteRequired,
    subOutreachStatus: teacherTimeOff.subOutreachStatus,
    teacherFirstName: users.firstName,
    teacherLastName: users.lastName,
    schoolName: schools.name,
    reasonName: absenceReasons.name,
  }

  // Today's list — shown in the table at the bottom
  const todayAbsences = orgId
    ? await db.select(absenceSelect).from(teacherTimeOff)
        .innerJoin(employees, eq(teacherTimeOff.employeeId, employees.id))
        .innerJoin(users, eq(employees.userId, users.id))
        .innerJoin(schools, eq(teacherTimeOff.schoolId, schools.id))
        .leftJoin(absenceReasons, eq(teacherTimeOff.reasonId, absenceReasons.id))
        .where(and(eq(teacherTimeOff.organizationId, orgId), eq(teacherTimeOff.date, today)))
    : []

  // All absences — used for stat card counts (pending items may be on future dates)
  const allAbsences = orgId
    ? await db.select(absenceSelect).from(teacherTimeOff)
        .innerJoin(employees, eq(teacherTimeOff.employeeId, employees.id))
        .innerJoin(users, eq(employees.userId, users.id))
        .innerJoin(schools, eq(teacherTimeOff.schoolId, schools.id))
        .leftJoin(absenceReasons, eq(teacherTimeOff.reasonId, absenceReasons.id))
        .where(eq(teacherTimeOff.organizationId, orgId))
    : []

  // Stat counts use allAbsences so future pending items aren't missed
  const stats = {
    total: todayAbsences.length,
    pending: allAbsences.filter((a) => a.approvalStatus === 'unapproved').length,
    waitingOnSub: allAbsences.filter((a) =>
      a.approvalStatus === 'approved' && a.substituteRequired && a.subOutreachStatus !== 'filled'
    ).length,
    subFound: allAbsences.filter((a) =>
      a.subOutreachStatus === 'filled'
    ).length,
    coveredByAdmin: allAbsences.filter((a) =>
      a.approvalStatus === 'approved' && !a.substituteRequired && a.subOutreachStatus !== 'filled'
    ).length,
  }

  // Pending absences = those needing attention right now
  const pendingAbsences = todayAbsences.filter((a) => a.approvalStatus === 'unapproved')

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}, {firstName}
        </h1>
        <p className="text-gray-500">
          {schoolName} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stat cards — live counts from the database */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          title="Total Absences"
          value={String(stats.total)}
          subtitle="today"
          color="blue"
        />
        <StatCard
          title="Pending Approval"
          value={String(stats.pending)}
          subtitle="all dates"
          color="yellow"
        />
        <StatCard
          title="Waiting on Sub"
          value={String(stats.waitingOnSub)}
          subtitle="all dates"
          color="orange"
        />
        <StatCard
          title="Sub Found"
          value={String(stats.subFound)}
          subtitle="all dates"
          color="green"
        />
        <StatCard
          title="Covered by Admin/Staff"
          value={String(stats.coveredByAdmin)}
          subtitle="all dates"
          color="gray"
        />
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
          href="/absences/approve"
          className="relative flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-green-300 hover:bg-green-50"
        >
          <ClipboardCheck className="h-8 w-8 text-green-600" />
          <div>
            <p className="font-semibold text-gray-900">Approve Absences</p>
            <p className="text-sm text-gray-500">Review pending requests</p>
          </div>
          {stats.pending > 0 && (
            <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-white">
              {stats.pending}
            </span>
          )}
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

        <div
          className="relative flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <Users className="h-8 w-8 text-orange-500" />
          <div>
            <p className="font-semibold text-gray-900">Unfilled</p>
            <p className="text-sm text-gray-500">Need a sub assigned</p>
          </div>
          {stats.waitingOnSub > 0 && (
            <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
              {stats.waitingOnSub}
            </span>
          )}
        </div>
      </div>

      {/* Today's absences table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Today&apos;s Absences</h2>
            <p className="text-sm text-gray-500">All reported absences for today</p>
          </div>
          {pendingAbsences.length > 0 && (
            <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
              {pendingAbsences.length} need approval
            </span>
          )}
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
                <div
                  className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                    absence.approvalStatus === 'approved'
                      ? 'bg-green-500'
                      : absence.approvalStatus === 'denied'
                      ? 'bg-red-500'
                      : 'bg-yellow-500'
                  }`}
                />

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

                {/* Right-side badges — always grouped together */}
                <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                  {absence.subOutreachStatus === 'filled' ? (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      Filled
                    </span>
                  ) : absence.approvalStatus === 'approved' && absence.substituteRequired ? (
                    <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                      Find Sub →
                    </span>
                  ) : null}

                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    absence.approvalStatus === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : absence.approvalStatus === 'denied'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {(absence.approvalStatus ?? 'unapproved') === 'unapproved' ? 'Pending' :
                     (absence.approvalStatus ?? '').charAt(0).toUpperCase() + (absence.approvalStatus ?? '').slice(1)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * StatCard — displays a single number with a label.
 * Used for the at-a-glance counts at the top of the dashboard.
 */
function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string
  value: string
  subtitle: string
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
    <div className={`rounded-lg border p-6 ${colorMap[color]}`}>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      <p className="text-sm opacity-75">{subtitle}</p>
    </div>
  )
}
