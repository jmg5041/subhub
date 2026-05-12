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

  // Guard: this route is scheduled at both 05:00 and 06:00 UTC so it fires at 10pm
  // regardless of whether Pacific is on PDT (UTC-7) or PST (UTC-8). Only one of the
  // two daily triggers will match — the other returns immediately.
  const TZ = 'America/Los_Angeles'
  const pacificHour = parseInt(
    new Date().toLocaleTimeString('en-US', { timeZone: TZ, hour: '2-digit', hour12: false }).split(':')[0]
  )
  if (pacificHour !== 22) {
    return NextResponse.json({ skipped: true, reason: `Pacific hour is ${pacificHour}, expected 22` })
  }

  // At 10pm Pacific, new Date() may already be the next UTC calendar day, so derive
  // "today" in Pacific time first and then add one day.
  const todayPacific = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const [py, pm, pd] = todayPacific.split('-').map(Number)
  const tomorrowStr = new Date(Date.UTC(py, pm - 1, pd + 1)).toISOString().split('T')[0]

  const pending = await db
    .select({ id: teacherTimeOff.id, organizationId: teacherTimeOff.organizationId })
    .from(teacherTimeOff)
    .where(and(
      eq(teacherTimeOff.startDate, tomorrowStr),
      eq(teacherTimeOff.approvalStatus, 'approved'),
      eq(teacherTimeOff.substituteRequired, true),
      eq(teacherTimeOff.subOutreachStatus, 'not_started'),
      ne(teacherTimeOff.approvalStatus, 'denied'),
    ))

  // Group by org so each org gets one bundled blast
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

  console.log(`[EVENING BLAST] for ${tomorrowStr}: ${pending.length} positions across ${byOrg.size} orgs`)
  return NextResponse.json({ date: tomorrowStr, orgs: byOrg.size, positions: pending.length, results })
}
