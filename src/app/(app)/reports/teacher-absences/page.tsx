import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, teacherTimeOff, organizations, employees } from '@/db/schema'
import { eq, and, gte, lte, asc } from 'drizzle-orm'
import PrintButton from '../sub-pay/PrintButton'

function countDays(startDate: string, endDate: string | null): number {
  if (!endDate || endDate === startDate) return 1
  const start = new Date(startDate + 'T12:00:00')
  const end   = new Date(endDate   + 'T12:00:00')
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function fmt(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default async function TeacherAbsencesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; teacher?: string }>
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

  const { from: fromP, to: toP, teacher: teacherP } = await searchParams
  const from = fromP ?? monthFrom
  const to   = toP   ?? monthTo

  // All teachers in org for dropdown
  const allTeachers = await db
    .select({ employeeId: employees.id, firstName: users.firstName, lastName: users.lastName })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .where(eq(users.organizationId, orgId))
    .orderBy(asc(users.lastName), asc(users.firstName))

  const absences = await db.query.teacherTimeOff.findMany({
    where: and(
      eq(teacherTimeOff.organizationId, orgId),
      gte(teacherTimeOff.startDate, from),
      lte(teacherTimeOff.startDate, to),
      teacherP ? eq(teacherTimeOff.employeeId, teacherP) : undefined,
    ),
    with: {
      employee: { with: { user: true } },
      school: true,
      reason: true,
    },
    orderBy: [asc(teacherTimeOff.startDate)],
  })

  // Group by employee
  type TeacherEntry = {
    name: string
    school: string
    totalAbsences: number
    totalDays: number
    reasons: Map<string, number>
    rows: typeof absences
  }
  const teacherMap = new Map<string, TeacherEntry>()

  for (const a of absences) {
    const key = a.employeeId
    const days = countDays(a.startDate, a.endDate)
    const reasonName = a.reason?.name ?? 'No reason given'
    if (!teacherMap.has(key)) {
      const u = a.employee.user
      teacherMap.set(key, {
        name: `${u.lastName}, ${u.firstName}`,
        school: a.school.name,
        totalAbsences: 0,
        totalDays: 0,
        reasons: new Map(),
        rows: [],
      })
    }
    const entry = teacherMap.get(key)!
    entry.totalAbsences++
    entry.totalDays += days
    entry.reasons.set(reasonName, (entry.reasons.get(reasonName) ?? 0) + 1)
    entry.rows.push(a)
  }

  const teachers = [...teacherMap.values()].sort((a, b) => a.name.localeCompare(b.name))
  const grandDays = teachers.reduce((s, t) => s + t.totalDays, 0)
  const csvHref = `/api/reports/teacher-absences?from=${from}&to=${to}${teacherP ? `&teacher=${teacherP}` : ''}`

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 print:hidden">
        <Link href="/reports" className="text-sm text-gray-400 hover:text-gray-600">← Reports</Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher Absence Summary</h1>
          <p className="mt-0.5 text-sm text-gray-500">{fmt(from)} – {fmt(to)}</p>
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
          <label className="text-sm text-gray-600">
            Teacher
            <select name="teacher" defaultValue={teacherP ?? ''}
              className="ml-1.5 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All teachers</option>
              {allTeachers.map(t => (
                <option key={t.employeeId} value={t.employeeId}>
                  {t.lastName}, {t.firstName}
                </option>
              ))}
            </select>
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

      {teachers.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No absences found for this date range.</p>
        </div>
      )}

      {teachers.length > 0 && (
        <div className="space-y-4">
          {/* Summary table */}
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="grid grid-cols-[2fr_2fr_1fr_1fr_2fr] gap-x-4 border-b border-gray-200 bg-gray-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span>Teacher</span>
              <span>School</span>
              <span className="text-right">Absences</span>
              <span className="text-right">Days Out</span>
              <span>Top Reason</span>
            </div>

            {teachers.map(t => {
              const topReason = [...t.reasons.entries()].sort((a, b) => b[1] - a[1])[0]
              return (
                <div key={t.name}
                  className="grid grid-cols-[2fr_2fr_1fr_1fr_2fr] gap-x-4 items-center border-t border-gray-100 px-6 py-3 text-sm hover:bg-gray-50">
                  <span className="font-medium text-gray-900">{t.name}</span>
                  <span className="text-gray-600">{t.school}</span>
                  <span className="text-right tabular-nums">{t.totalAbsences}</span>
                  <span className="text-right tabular-nums font-medium">{t.totalDays}</span>
                  <span className="text-gray-500">
                    {topReason ? `${topReason[0]} (${topReason[1]}×)` : '—'}
                  </span>
                </div>
              )
            })}

            {/* Grand total */}
            <div className="grid grid-cols-[2fr_2fr_1fr_1fr_2fr] gap-x-4 items-center border-t-2 border-gray-300 bg-gray-50 px-6 py-3 text-sm font-bold">
              <span className="col-span-2 text-gray-900">
                TOTAL — {teachers.length} teacher{teachers.length !== 1 ? 's' : ''}
              </span>
              <span className="text-right tabular-nums">{absences.length}</span>
              <span className="text-right tabular-nums">{grandDays}</span>
              <span />
            </div>
          </div>

          {/* Detail by teacher */}
          {teachers.map(t => (
            <div key={t.name} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between bg-blue-50 px-6 py-3">
                <span className="font-semibold text-blue-900">{t.name}</span>
                <span className="text-sm text-blue-700">
                  {t.totalAbsences} absence{t.totalAbsences !== 1 ? 's' : ''} · {t.totalDays} day{t.totalDays !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {t.rows.map(a => {
                  const days = countDays(a.startDate, a.endDate)
                  const isFilled = a.subOutreachStatus === 'filled'
                  const dateLabel = a.endDate && a.endDate !== a.startDate
                    ? `${fmt(a.startDate)} – ${fmt(a.endDate)}`
                    : fmt(a.startDate)
                  return (
                    <div key={a.id} className="grid grid-cols-[2fr_1fr_2fr_1fr] gap-x-4 px-6 py-3 text-sm text-gray-700">
                      <span>{dateLabel}</span>
                      <span className="tabular-nums">{days} day{days !== 1 ? 's' : ''}</span>
                      <span className="text-gray-500">{a.reason?.name ?? '—'}</span>
                      <span className={isFilled ? 'text-green-600' : a.substituteRequired ? 'text-red-500' : 'text-gray-400'}>
                        {!a.substituteRequired ? 'No sub needed' : isFilled ? 'Sub filled' : 'Unfilled'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
