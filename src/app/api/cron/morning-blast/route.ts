import { NextResponse } from 'next/server'
import { db } from '@/db'
import { teacherTimeOff } from '@/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { notifyAllSubs } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Guard: scheduled at both 13:00 and 14:00 UTC so it fires at 6am Pacific regardless
  // of PDT (UTC-7) or PST (UTC-8). Only the trigger that lands on hour 6 does work.
  const TZ = 'America/Los_Angeles'
  const pacificHour = parseInt(
    new Date().toLocaleTimeString('en-US', { timeZone: TZ, hour: '2-digit', hour12: false }).split(':')[0]
  )
  if (pacificHour !== 6) {
    return NextResponse.json({ skipped: true, reason: `Pacific hour is ${pacificHour}, expected 6` })
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ })

  const pending = await db
    .select({ id: teacherTimeOff.id, organizationId: teacherTimeOff.organizationId })
    .from(teacherTimeOff)
    .where(and(
      eq(teacherTimeOff.startDate, today),
      eq(teacherTimeOff.approvalStatus, 'approved'),
      eq(teacherTimeOff.substituteRequired, true),
      eq(teacherTimeOff.subOutreachStatus, 'not_started'),
      ne(teacherTimeOff.approvalStatus, 'denied'),
    ))

  // Group by org so each org gets one bundled blast (one notification per sub)
  const byOrg = new Map<string, string[]>()
  for (const a of pending) {
    const ids = byOrg.get(a.organizationId) ?? []
    ids.push(a.id)
    byOrg.set(a.organizationId, ids)
  }

  const results = []
  for (const [orgId, ids] of byOrg) {
    try {
      const result = await notifyAllSubs(ids)
      results.push({ orgId, positions: ids.length, sent: result.sent, errors: result.errors })
    } catch (err) {
      results.push({ orgId, positions: ids.length, error: String(err) })
    }
  }

  console.log(`[MORNING BLAST] ${today}: ${pending.length} positions across ${byOrg.size} orgs`)
  return NextResponse.json({ date: today, orgs: byOrg.size, positions: pending.length, results })
}
