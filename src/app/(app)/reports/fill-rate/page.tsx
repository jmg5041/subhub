import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, teacherTimeOff, organizations } from '@/db/schema'
import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import PrintButton from '../sub-pay/PrintButton'

function fmt(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function pct(filled: number, total: number) {
  if (total === 0) return '—'
  return `${Math.round((filled / total) * 100)}%`
}

export default async function FillRatePage({
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
  const monthTo   = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`

  const { from: fromP, to: toP } = await searchParams
  const from = fromP ?? monthFrom
  const to   = toP   ?? monthTo

  // Only approved absences that required a sub
  const absences = await db.query.teacherTimeOff.findMany({
    where: and(
      eq(teacherTimeOff.organizationId, orgId),
      gte(teacherTimeOff.startDate, from),
      lte(teacherTimeOff.startDate, to),
      eq(teacherTimeOff.substituteRequired, true),
      inArray(teacherTimeOff.approvalStatus, ['approved', 'partially_approved']),
    ),
    with: {
      school: true,
      employee: { with: { user: true } },
      reason: true,
    },
    orderBy: (t, { asc }) => [asc(t.startDate)],
  })

  const total    = absences.length
  const filled   = absences.filter(a => a.subOutreachStatus === 'filled').length
  const unfilled = total - filled
  const rate     = pct(filled, total)

  // Per-school breakdown
  const schoolMap = new Map<string, { name: string; total: number; filled: number }>()
  for (const a of absences) {
    if (!schoolMap.has(a.schoolId)) {
      schoolMap.set(a.schoolId, { name: a.school.name, total: 0, filled: 0 })
    }
    const s = schoolMap.get(a.schoolId)!
    s.total++
    if (a.subOutreachStatus === 'filled') s.filled++
  }
  const schools = [...schoolMap.values()].sort((a, b) => a.name.localeCompare(b.name))

  // Unfilled absences list
  const unfilledList = absences.filter(a => a.subOutreachStatus !== 'filled')

  const csvHref = `/api/reports/fill-rate?from=${from}&to=${to}`

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 print:hidden">
        <Link href="/reports" className="text-sm text-gray-400 hover:text-gray-600">← Reports</Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fill Rate Report</h1>
          <p className="mt-0.5 text-sm text-gray-500">{fmt(from)} – {fmt(to)} · Approved absences requiring a substitute</p>
        </div>

        <form method="GET" className="flex flex-wrap items-center gap-2 print:hidden">
          <label className="text-sm text-gray-600">
            From
            <input type="date" name="from" defaultValue={from}
              className="ml-1.5 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="text-sm text-gray-600">
            To
            <input type="date" name="to" defaultValue={to}
              className="ml-1.5 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <button type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Run Report
          </button>
          <a href={csvHref}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Download CSV
          </a>
          <PrintButton />
        </form>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Fill Rate',         value: rate,               color: 'text-blue-600'  },
          { label: 'Positions Filled',  value: String(filled),     color: 'text-green-600' },
          { label: 'Positions Unfilled',value: String(unfilled),   color: 'text-red-500'   },
          { label: 'Total Positions',   value: String(total),      color: 'text-gray-700'  },
        ].map(card => (
          <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-5 text-center">
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            <p className="mt-1 text-xs text-gray-500 uppercase tracking-wider">{card.label}</p>
          </div>
        ))}
      </div>

      {total === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No approved absences requiring a substitute in this date range.</p>
        </div>
      )}

      {total > 0 && (
        <>
          {/* Per-school breakdown */}
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
              <h2 className="text-sm font-semibold text-gray-700">By School</h2>
            </div>
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-x-4 border-b border-gray-100 px-6 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <span>School</span>
              <span className="text-right">Total</span>
              <span className="text-right">Filled</span>
              <span className="text-right">Unfilled</span>
              <span className="text-right">Fill Rate</span>
            </div>
            {schools.map(s => (
              <div key={s.name}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-x-4 items-center border-t border-gray-100 px-6 py-3 text-sm">
                <span className="font-medium text-gray-900">{s.name}</span>
                <span className="text-right tabular-nums text-gray-600">{s.total}</span>
                <span className="text-right tabular-nums text-green-600">{s.filled}</span>
                <span className="text-right tabular-nums text-red-500">{s.total - s.filled}</span>
                <span className="text-right tabular-nums font-medium text-blue-600">{pct(s.filled, s.total)}</span>
              </div>
            ))}
          </div>

          {/* Unfilled absences detail */}
          {unfilledList.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 bg-red-50 px-6 py-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-red-800">
                  Unfilled Positions ({unfilledList.length})
                </h2>
                <p className="text-xs text-red-600">These absences had no substitute assigned</p>
              </div>
              <div className="grid grid-cols-[1.5fr_2fr_1.5fr_2fr] gap-x-4 border-b border-gray-100 px-6 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <span>Date</span>
                <span>Teacher</span>
                <span>School</span>
                <span>Reason</span>
              </div>
              {unfilledList.map(a => (
                <div key={a.id}
                  className="grid grid-cols-[1.5fr_2fr_1.5fr_2fr] gap-x-4 items-center border-t border-gray-100 px-6 py-3 text-sm text-gray-700 hover:bg-gray-50">
                  <span className="tabular-nums">{fmt(a.startDate)}{a.endDate && a.endDate !== a.startDate ? ` – ${fmt(a.endDate)}` : ''}</span>
                  <span>{a.employee.user.firstName} {a.employee.user.lastName}</span>
                  <span className="text-gray-500">{a.school.name}</span>
                  <span className="text-gray-500">{a.reason?.name ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
