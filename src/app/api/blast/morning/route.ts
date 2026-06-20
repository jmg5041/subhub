/**
 * Morning blast — notifies subs for today's unfilled positions (6am).
 * Covers both never-blasted (not_started) and blasted-last-night-but-unfilled (sent).
 */

import { NextResponse } from 'next/server'
import { verifyQStashRequest } from '@/lib/qstash'
import { db } from '@/db'
import { organizations, teacherTimeOff } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
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
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz })

  const pending = await db
    .select({ id: teacherTimeOff.id })
    .from(teacherTimeOff)
    .where(and(
      eq(teacherTimeOff.organizationId, orgId),
      eq(teacherTimeOff.startDate, today),
      eq(teacherTimeOff.approvalStatus, 'approved'),
      eq(teacherTimeOff.substituteRequired, true),
      inArray(teacherTimeOff.subOutreachStatus, ['not_started', 'sent']),
    ))

  if (pending.length === 0) return NextResponse.json({ orgId, positions: 0 })

  const result = await notifyAllSubs(pending.map(p => p.id))
  console.log(`[MORNING BLAST] org=${orgId} today=${today} positions=${pending.length}`)
  return NextResponse.json({ orgId, today, positions: pending.length, ...result })
}
