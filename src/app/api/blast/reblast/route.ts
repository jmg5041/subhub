/**
 * Reblast — 6:20am follow-up for positions still unfilled after the morning blast.
 * Re-notifies subs who haven't yet declined.
 */

import { NextResponse } from 'next/server'
import { verifyQStashRequest } from '@/lib/qstash'
import { db } from '@/db'
import { organizations, teacherTimeOff } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { reBlastNonDecliners } from '@/lib/notifications'

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

  const stillUnfilled = await db
    .select({ id: teacherTimeOff.id })
    .from(teacherTimeOff)
    .where(and(
      eq(teacherTimeOff.organizationId, orgId),
      eq(teacherTimeOff.startDate, today),
      eq(teacherTimeOff.approvalStatus, 'approved'),
      eq(teacherTimeOff.substituteRequired, true),
      eq(teacherTimeOff.subOutreachStatus, 'sent'),
    ))

  if (stillUnfilled.length === 0) return NextResponse.json({ orgId, positions: 0 })

  const results = await Promise.allSettled(
    stillUnfilled.map(row => reBlastNonDecliners(row.id))
  )
  const sent = results.filter(r => r.status === 'fulfilled').length
  console.log(`[REBLAST] org=${orgId} today=${today} positions=${stillUnfilled.length} sent=${sent}`)
  return NextResponse.json({ orgId, today, positions: stillUnfilled.length, sent })
}
