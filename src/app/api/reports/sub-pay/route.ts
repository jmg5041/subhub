/**
 * Sub Pay CSV download — GET /api/reports/sub-pay?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns a .csv file with one row per sub assignment, plus a summary section
 * at the bottom showing totals per substitute. Designed to open cleanly in
 * Excel, Numbers, or import into payroll software.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, subAssignments } from '@/db/schema'
import { eq, and, gte, lte, ne } from 'drizzle-orm'

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function formatDateCSV(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  })
}

// Wrap a value in quotes and escape any internal quotes
function csvCell(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val)
  return `"${s.replace(/"/g, '""')}"`
}

function csvRow(...cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(',')
}

export async function GET(req: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = profile.organizationId

  // Date range from query params — default to current month
  const TZ = 'America/Los_Angeles'
  const nowStr = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const [y, m] = nowStr.split('-').map(Number)
  const monthFrom = `${y}-${String(m).padStart(2, '0')}-01`
  const monthTo = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`

  const from = req.nextUrl.searchParams.get('from') ?? monthFrom
  const to = req.nextUrl.searchParams.get('to') ?? monthTo

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

  // Sort assignments by sub last name, then date
  const sorted = [...rawAssignments].sort((a, b) => {
    const nameA = `${a.substitute.user.lastName}, ${a.substitute.user.firstName}`
    const nameB = `${b.substitute.user.lastName}, ${b.substitute.user.firstName}`
    if (nameA !== nameB) return nameA.localeCompare(nameB)
    return a.date.localeCompare(b.date)
  })

  // Group by sub for summary section
  const subMap = new Map<string, { name: string; totalHours: number; totalPay: number; paySet: boolean }>()
  for (const a of sorted) {
    const u = a.substitute.user
    const key = a.substituteId
    const name = `${u.lastName}, ${u.firstName}`
    if (!subMap.has(key)) subMap.set(key, { name, totalHours: 0, totalPay: 0, paySet: false })
    const entry = subMap.get(key)!
    entry.totalHours += parseFloat(a.totalHours ?? '0')
    entry.totalPay += parseFloat(a.totalPay ?? '0')
    if (a.totalPay) entry.paySet = true
  }

  const lines: string[] = []

  // Report header
  lines.push(csvRow('SUB PAY REPORT'))
  lines.push(csvRow(`Period: ${from} to ${to}`))
  lines.push(csvRow(`Generated: ${nowStr}`))
  lines.push('')

  // Column headers
  lines.push(csvRow(
    'Sub Name',
    'Email',
    'School',
    'Date',
    'Start Time',
    'End Time',
    'Hours',
    'Pay Rate',
    'Total Pay',
    'Teachers Covered',
    'Reason',
  ))

  // Detail rows
  for (const a of sorted) {
    const u = a.substitute.user
    const teachers = a.timeOffLinks
      .map(l => {
        const tu = l.timeOff.employee?.user
        return tu ? `${tu.firstName} ${tu.lastName}` : null
      })
      .filter(Boolean)
      .join('; ')

    const reasons = [...new Set(
      a.timeOffLinks.map(l => l.timeOff.reason?.name).filter(Boolean)
    )].join('; ')

    lines.push(csvRow(
      `${u.lastName}, ${u.firstName}`,
      u.email,
      a.school.name,
      formatDateCSV(a.date),
      formatTime(a.startTime),
      formatTime(a.endTime),
      parseFloat(a.totalHours ?? '0').toFixed(2),
      a.payRate ? `$${parseFloat(a.payRate).toFixed(2)}/hr` : '',
      a.totalPay ? `$${parseFloat(a.totalPay).toFixed(2)}` : '',
      teachers,
      reasons,
    ))
  }

  // Summary section
  lines.push('')
  lines.push(csvRow('SUMMARY BY SUBSTITUTE'))
  lines.push(csvRow('Sub Name', '', '', '', '', '', 'Total Hours', '', 'Total Pay'))

  for (const [, sub] of subMap) {
    lines.push(csvRow(
      sub.name,
      '', '', '', '', '',
      sub.totalHours.toFixed(2),
      '',
      sub.paySet ? `$${sub.totalPay.toFixed(2)}` : '',
    ))
  }

  // Grand total
  const grandHours = [...subMap.values()].reduce((s, v) => s + v.totalHours, 0)
  const grandPay = [...subMap.values()].reduce((s, v) => s + v.totalPay, 0)
  const anyPaySet = [...subMap.values()].some(v => v.paySet)
  lines.push('')
  lines.push(csvRow(
    'GRAND TOTAL',
    '', '', '', '', '',
    grandHours.toFixed(2),
    '',
    anyPaySet ? `$${grandPay.toFixed(2)}` : '',
  ))

  const csv = lines.join('\n')
  const filename = `sub-pay-${from}-to-${to}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
