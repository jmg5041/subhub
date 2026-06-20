/**
 * Unfilled alert — 6:30am email to admin if any positions are still unfilled.
 */

import { NextResponse } from 'next/server'
import { verifyQStashRequest } from '@/lib/qstash'
import { db } from '@/db'
import { organizations, teacherTimeOff } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { notifyAdminsUnfilled } from '@/lib/notifications'

export const runtime = 'nodejs'
export const maxDuration = 60

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

  const unfilled = await db
    .select({ id: teacherTimeOff.id })
    .from(teacherTimeOff)
    .where(and(
      eq(teacherTimeOff.organizationId, orgId),
      eq(teacherTimeOff.startDate, today),
      eq(teacherTimeOff.approvalStatus, 'approved'),
      eq(teacherTimeOff.substituteRequired, true),
      eq(teacherTimeOff.subOutreachStatus, 'sent'),
    ))

  if (unfilled.length === 0) return NextResponse.json({ orgId, unfilled: 0 })

  await Promise.allSettled(unfilled.map(a => notifyAdminsUnfilled(a.id)))
  console.log(`[UNFILLED ALERT] org=${orgId} today=${today} unfilled=${unfilled.length}`)
  return NextResponse.json({ orgId, today, unfilled: unfilled.length })
}
