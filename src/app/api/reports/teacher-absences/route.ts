import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, teacherTimeOff, organizations, employees } from '@/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'

function countDays(startDate: string, endDate: string | null): number {
  if (!endDate || endDate === startDate) return 1
  const start = new Date(startDate + 'T12:00:00')
  const end   = new Date(endDate   + 'T12:00:00')
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    if (cur.getDay() !== 0 && cur.getDay() !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

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

  const from      = req.nextUrl.searchParams.get('from') ?? monthFrom
  const to        = req.nextUrl.searchParams.get('to')   ?? monthTo
  const teacherP  = req.nextUrl.searchParams.get('teacher') || null

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
    orderBy: (t, { asc }) => [asc(t.startDate)],
  })

  const lines: string[] = []
  lines.push(csvRow('TEACHER ABSENCE SUMMARY'))
  lines.push(csvRow(`Period: ${from} to ${to}`))
  lines.push(csvRow(`Generated: ${nowStr}`))
  lines.push('')
  lines.push(csvRow('Teacher', 'School', 'Start Date', 'End Date', 'Days', 'Reason', 'Sub Required', 'Sub Filled', 'Approval Status'))

  for (const a of absences) {
    const u = a.employee.user
    const days = countDays(a.startDate, a.endDate)
    lines.push(csvRow(
      `${u.lastName}, ${u.firstName}`,
      a.school.name,
      fmtDate(a.startDate),
      a.endDate ? fmtDate(a.endDate) : fmtDate(a.startDate),
      days,
      a.reason?.name ?? '',
      a.substituteRequired ? 'Yes' : 'No',
      a.subOutreachStatus === 'filled' ? 'Yes' : a.substituteRequired ? 'No' : 'N/A',
      a.approvalStatus,
    ))
  }

  // Summary by teacher
  const teacherSummary = new Map<string, { name: string; absences: number; days: number }>()
  for (const a of absences) {
    const u = a.employee.user
    const key = a.employeeId
    if (!teacherSummary.has(key)) teacherSummary.set(key, { name: `${u.lastName}, ${u.firstName}`, absences: 0, days: 0 })
    const e = teacherSummary.get(key)!
    e.absences++
    e.days += countDays(a.startDate, a.endDate)
  }

  lines.push('')
  lines.push(csvRow('SUMMARY BY TEACHER'))
  lines.push(csvRow('Teacher', '', 'Total Absences', 'Total Days'))
  for (const [, t] of teacherSummary) {
    lines.push(csvRow(t.name, '', t.absences, t.days))
  }

  const csv = lines.join('\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="teacher-absences-${from}-to-${to}.csv"`,
    },
  })
}
