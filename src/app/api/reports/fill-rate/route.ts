import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, teacherTimeOff, organizations } from '@/db/schema'
import { eq, and, gte, lte, inArray } from 'drizzle-orm'

function csvCell(val: string | number | null | undefined) {
  const s = val == null ? '' : String(val)
  return `"${s.replace(/"/g, '""')}"`
}
function csvRow(...cells: (string | number | null | undefined)[]) {
  return cells.map(csvCell).join(',')
}
function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = profile.organizationId

  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
  const TZ = org?.timezone ?? 'America/Los_Angeles'
  const nowStr = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const [y, m] = nowStr.split('-').map(Number)
  const monthFrom = `${y}-${String(m).padStart(2, '0')}-01`
  const monthTo   = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`

  const from = req.nextUrl.searchParams.get('from') ?? monthFrom
  const to   = req.nextUrl.searchParams.get('to')   ?? monthTo

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

  const total  = absences.length
  const filled = absences.filter(a => a.subOutreachStatus === 'filled').length
  const rate   = total > 0 ? `${Math.round((filled / total) * 100)}%` : '—'

  const lines: string[] = []
  lines.push(csvRow('FILL RATE REPORT'))
  lines.push(csvRow(`Period: ${from} to ${to}`))
  lines.push(csvRow(`Generated: ${nowStr}`))
  lines.push('')
  lines.push(csvRow('Overall Fill Rate', rate))
  lines.push(csvRow('Total Positions',   total))
  lines.push(csvRow('Filled',            filled))
  lines.push(csvRow('Unfilled',          total - filled))
  lines.push('')

  // By school summary
  const schoolMap = new Map<string, { name: string; total: number; filled: number }>()
  for (const a of absences) {
    if (!schoolMap.has(a.schoolId)) schoolMap.set(a.schoolId, { name: a.school.name, total: 0, filled: 0 })
    const s = schoolMap.get(a.schoolId)!
    s.total++
    if (a.subOutreachStatus === 'filled') s.filled++
  }

  lines.push(csvRow('BY SCHOOL'))
  lines.push(csvRow('School', 'Total', 'Filled', 'Unfilled', 'Fill Rate'))
  for (const [, s] of schoolMap) {
    const r = s.total > 0 ? `${Math.round((s.filled / s.total) * 100)}%` : '—'
    lines.push(csvRow(s.name, s.total, s.filled, s.total - s.filled, r))
  }
  lines.push('')

  // Detail rows
  lines.push(csvRow('ALL POSITIONS'))
  lines.push(csvRow('Date', 'Teacher', 'School', 'Reason', 'Filled'))
  for (const a of absences) {
    const u = a.employee.user
    const dateLabel = a.endDate && a.endDate !== a.startDate
      ? `${fmtDate(a.startDate)} – ${fmtDate(a.endDate)}`
      : fmtDate(a.startDate)
    lines.push(csvRow(
      dateLabel,
      `${u.lastName}, ${u.firstName}`,
      a.school.name,
      a.reason?.name ?? '',
      a.subOutreachStatus === 'filled' ? 'Yes' : 'No',
    ))
  }

  const csv = lines.join('\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="fill-rate-${from}-to-${to}.csv"`,
    },
  })
}
