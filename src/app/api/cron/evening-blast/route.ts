import { NextResponse } from 'next/server'
import { db } from '@/db'
import { organizations, teacherTimeOff } from '@/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { notifyAllSubs } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Runs at 10pm Pacific. Two UTC entries cover both PDT (UTC-7) and PST (UTC-8):
//   0 5 * * * = 10pm PDT  |  0 6 * * * = 10pm PST
// The localHour check ensures each org is only processed when it is actually 10pm there.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allOrgs = await db.select({ id: organizations.id, timezone: organizations.timezone }).from(organizations)

  const results = []
  let totalPositions = 0

  for (const org of allOrgs) {
    const tz = org.timezone ?? 'America/Los_Angeles'
    const localHour = parseInt(
      new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).split(':')[0]
    )
    if (localHour !== 22) continue

    // Compute tomorrow in this org's local timezone — can't use UTC arithmetic here
    // because at 10pm the UTC date may already be the next day.
    const todayLocal = new Date().toLocaleDateString('en-CA', { timeZone: tz })
    const [y, m, d] = todayLocal.split('-').map(Number)
    const tomorrowStr = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().split('T')[0]

    const pending = await db
      .select({ id: teacherTimeOff.id })
      .from(teacherTimeOff)
      .where(and(
        eq(teacherTimeOff.organizationId, org.id),
        eq(teacherTimeOff.startDate, tomorrowStr),
        eq(teacherTimeOff.approvalStatus, 'approved'),
        eq(teacherTimeOff.substituteRequired, true),
        eq(teacherTimeOff.subOutreachStatus, 'not_started'),
        ne(teacherTimeOff.approvalStatus, 'denied'),
      ))

    if (pending.length === 0) continue
    totalPositions += pending.length

    try {
      const result = await notifyAllSubs(pending.map(p => p.id))
      results.push({ orgId: org.id, tz, tomorrow: tomorrowStr, positions: pending.length, sent: result.sent, errors: result.errors })
    } catch (err) {
      results.push({ orgId: org.id, tz, error: String(err) })
    }
  }

  console.log(`[EVENING BLAST] ${totalPositions} positions across ${results.length} orgs`)
  return NextResponse.json({ positions: totalPositions, orgs: results.length, results })
}
