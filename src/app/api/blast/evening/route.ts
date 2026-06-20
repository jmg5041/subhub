/**
 * Evening blast — notifies subs for tomorrow's unfilled positions.
 * Called by QStash for one org at a time. Retried automatically on 5xx.
 */

import { NextResponse } from 'next/server'
import { verifyQStashRequest } from '@/lib/qstash'
import { db } from '@/db'
import { organizations, teacherTimeOff } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { notifyAllSubs } from '@/lib/notifications'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  let orgId: string
  try {
    ({ orgId } = await verifyQStashRequest(req))
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { timezone: true, cronEnabled: true },
  })
  if (!org?.cronEnabled) return NextResponse.json({ skipped: true })

  const tz = org.timezone ?? 'America/Los_Angeles'
  const todayLocal = new Date().toLocaleDateString('en-CA', { timeZone: tz })
  const [y, m, d] = todayLocal.split('-').map(Number)
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().split('T')[0]

  const pending = await db
    .select({ id: teacherTimeOff.id })
    .from(teacherTimeOff)
    .where(and(
      eq(teacherTimeOff.organizationId, orgId),
      eq(teacherTimeOff.startDate, tomorrow),
      eq(teacherTimeOff.approvalStatus, 'approved'),
      eq(teacherTimeOff.substituteRequired, true),
      eq(teacherTimeOff.subOutreachStatus, 'not_started'),
    ))

  if (pending.length === 0) return NextResponse.json({ orgId, positions: 0 })

  const result = await notifyAllSubs(pending.map(p => p.id))
  console.log(`[EVENING BLAST] org=${orgId} tomorrow=${tomorrow} positions=${pending.length}`)
  return NextResponse.json({ orgId, tomorrow, positions: pending.length, ...result })
}
