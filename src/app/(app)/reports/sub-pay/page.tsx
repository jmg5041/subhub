/**
 * Sub Pay Report
 *
 * Shows all substitute assignments within a date range, grouped by sub.
 * Each sub section lists individual dates worked with hours and teacher covered.
 * Used by payroll staff to know who to pay and how much.
 *
 * The CSV download button points to /api/reports/sub-pay which runs the same
 * query and returns a .csv file for import into payroll software or Excel.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, subAssignments, organizations } from '@/db/schema'
import { eq, and, gte, lte, ne } from 'drizzle-orm'
import PrintButton from './PrintButton'

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function formatDateLong(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatDateHeader(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function fmt(n: string | null | undefined) {
  if (!n) return '—'
  return `$${parseFloat(n).toFixed(2)}`
}

export default async function SubPayReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile) redirect('/auth/login')
  const orgId = profile.organizationId

  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
  const TZ = org?.timezone ?? 'America/Los_Angeles'
  const nowStr = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const [y, m] = nowStr.split('-').map(Number)
  const monthFrom = `${y}-${String(m).padStart(2, '0')}-01`
  const monthTo = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`

  const { from: fromParam, to: toParam } = await searchParams
  const from = fromParam ?? monthFrom
  const to = toParam ?? monthTo

  const rawAssignments = await db.query.subAssignments.findMany({
    where: and(
      eq(subAssignments.organizationId, orgId),
      gte(subAssignments.date, from),
      lte(subAssignments.date, to),
      ne(subAssignments.status, 'cancelled'),
    ),
    with: {
      substitute: { with: { user: true } },
      school: true,
      timeOffLinks: {
        with: {
          timeOff: {
            with: {
              employee: { with: { user: true } },
              reason: true,
            },
          },
        },
      },
    },
    orderBy: (a, { asc }) => [asc(a.date)],
  })

  // Group by substitute, sorted by last name
  const subMap = new Map<string, {
    name: string
    email: string | null
    assignments: typeof rawAssignments
  }>()

  for (const a of rawAssignments) {
    const subId = a.substituteId
    if (!subMap.has(subId)) {
      const u = a.substitute.user
      subMap.set(subId, {
        name: `${u.lastName}, ${u.firstName}`,
        email: u.email,
        assignments: [],
      })
    }
    subMap.get(subId)!.assignments.push(a)
  }

  const subs = [...subMap.values()].sort((a, b) => a.name.localeCompare(b.name))

  const grandTotalHours = rawAssignments.reduce((sum, a) => sum + parseFloat(a.totalHours ?? '0'), 0)
  const grandTotalPay = rawAssignments.reduce((sum, a) => sum + parseFloat(a.totalPay ?? '0'), 0)
  const anyPaySet = rawAssignments.some(a => a.totalPay)

  const csvHref = `/api/reports/sub-pay?from=${from}&to=${to}`

  return (
    <div className="space-y-6">
      {/* Header — hidden when printing */}
      <div className="flex items-center gap-2 print:hidden">
        <Link href="/reports" className="text-sm text-gray-400 hover:text-gray-600">← Reports</Link>
      </div>

      {/* Title + controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sub Pay Report</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {formatDateHeader(from)} – {formatDateHeader(to)}
          </p>
        </div>

        {/* Date filter form */}
        <form method="GET" className="flex flex-wrap items-center gap-2 print:hidden">
          <label className="text-sm text-gray-600">
            From
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="ml-1.5 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="text-sm text-gray-600">
            To
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="ml-1.5 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Run Report
          </button>
          <a
            href={csvHref}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Download CSV
          </a>
          <PrintButton />
        </form>
      </div>

      {/* Empty state */}
      {subs.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No substitute assignments found for this date range.</p>
        </div>
      )}

      {/* Report body */}
      {subs.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {/* Column headers */}
          <div className="grid grid-cols-[2fr_1.5fr_1fr_auto_auto_auto_2fr] gap-x-4 border-b border-gray-200 bg-gray-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 print:grid-cols-[2fr_1.5fr_1fr_auto_auto_2fr]">
            <span>School</span>
            <span>Date</span>
            <span>Time</span>
            <span className="text-right">Hours</span>
            <span className="text-right print:hidden">Pay Rate</span>
            <span className="text-right">Total Pay</span>
            <span>Teacher(s) / Reason</span>
          </div>

          {subs.map((sub) => {
            const subHours = sub.assignments.reduce((s, a) => s + parseFloat(a.totalHours ?? '0'), 0)
            const subPay = sub.assignments.reduce((s, a) => s + parseFloat(a.totalPay ?? '0'), 0)
            const subPaySet = sub.assignments.some(a => a.totalPay)

            return (
              <div key={sub.name} className="border-b border-gray-100 last:border-0">
                {/* Sub header row */}
                <div className="flex items-baseline justify-between bg-blue-50 px-6 py-3">
                  <div>
                    <span className="font-semibold text-blue-900">{sub.name}</span>
                    {sub.email && (
                      <span className="ml-2 text-sm text-blue-600">{sub.email}</span>
                    )}
                  </div>
                  <div className="flex gap-6 text-sm font-medium text-blue-800">
                    <span>{subHours.toFixed(2)} hrs</span>
                    <span>{subPaySet ? fmt(subPay.toFixed(2)) : '—'}</span>
                  </div>
                </div>

                {/* Assignment rows */}
                {sub.assignments.map((a) => {
                  const teachers = a.timeOffLinks
                    .map(l => {
                      const u = l.timeOff.employee?.user
                      return u ? `${u.firstName} ${u.lastName}` : null
                    })
                    .filter(Boolean)

                  const reasons = a.timeOffLinks
                    .map(l => l.timeOff.reason?.name)
                    .filter(Boolean)
                  const uniqueReasons = [...new Set(reasons)]

                  return (
                    <div
                      key={a.id}
                      className="grid grid-cols-[2fr_1.5fr_1fr_auto_auto_auto_2fr] items-center gap-x-4 border-t border-gray-100 px-6 py-3 text-sm text-gray-700 hover:bg-gray-50 print:grid-cols-[2fr_1.5fr_1fr_auto_auto_2fr]"
                    >
                      <span className="font-medium text-gray-900">{a.school.name}</span>
                      <span>{formatDateLong(a.date)}</span>
                      <span className="text-gray-500 tabular-nums">
                        {formatTime(a.startTime)} – {formatTime(a.endTime)}
                      </span>
                      <span className="text-right tabular-nums">{parseFloat(a.totalHours ?? '0').toFixed(2)}</span>
                      <span className="text-right tabular-nums text-gray-400 print:hidden">
                        {a.payRate ? `$${parseFloat(a.payRate).toFixed(2)}/hr` : '—'}
                      </span>
                      <span className="text-right tabular-nums">
                        {a.totalPay ? fmt(a.totalPay) : '—'}
                      </span>
                      <span className="text-gray-500">
                        {teachers.length > 0 ? teachers.join(', ') : '—'}
                        {uniqueReasons.length > 0 && (
                          <span className="ml-1 text-gray-400">({uniqueReasons.join(', ')})</span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Grand total row */}
          <div className="grid grid-cols-[2fr_1.5fr_1fr_auto_auto_auto_2fr] items-center gap-x-4 border-t-2 border-gray-300 bg-gray-50 px-6 py-4 print:grid-cols-[2fr_1.5fr_1fr_auto_auto_2fr]">
            <span className="col-span-3 font-bold text-gray-900">
              TOTAL — {rawAssignments.length} assignment{rawAssignments.length !== 1 ? 's' : ''}, {subs.length} substitute{subs.length !== 1 ? 's' : ''}
            </span>
            <span className="text-right font-bold tabular-nums">{grandTotalHours.toFixed(2)}</span>
            <span className="print:hidden" />
            <span className="text-right font-bold tabular-nums">
              {anyPaySet ? fmt(grandTotalPay.toFixed(2)) : '—'}
            </span>
            <span />
          </div>
        </div>
      )}

      {/* Pay rate note */}
      {rawAssignments.length > 0 && !anyPaySet && (
        <p className="text-xs text-gray-400 print:hidden">
          Pay rates are not yet configured. Set rates during reconciliation to see total pay calculations.
        </p>
      )}
    </div>
  )
}
