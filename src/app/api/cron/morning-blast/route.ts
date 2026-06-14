import { NextResponse } from 'next/server'
import { db } from '@/db'
import { organizations, teacherTimeOff } from '@/db/schema'
import { eq, and, ne, inArray } from 'drizzle-orm'
import { notifyAllSubs } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Runs at 6am Pacific. Two UTC entries cover both PDT (UTC-7) and PST (UTC-8):
//   0 13 * * * = 6am PDT  |  0 14 * * * = 6am PST
// Blasts ALL unfilled positions for today — both never-blasted (not_started) and
// blasted last night but still unfilled (sent). The 6:20am re-blast handles anything
// still unfilled after this run.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allOrgs = await db.select({ id: organizations.id, timezone: organizations.timezone, subscriptionStatus: organizations.subscriptionStatus }).from(organizations)

  const results = []
  let totalPositions = 0

  for (const org of allOrgs) {
    const tz = org.timezone ?? 'America/Los_Angeles'
    const localHour = parseInt(
      new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).split(':')[0]
    )
    if (localHour !== 6) continue
    if (org.subscriptionStatus === 'expired') continue

    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz })

    const pending = await db
      .select({ id: teacherTimeOff.id })
      .from(teacherTimeOff)
      .where(and(
        eq(teacherTimeOff.organizationId, org.id),
        eq(teacherTimeOff.startDate, today),
        eq(teacherTimeOff.approvalStatus, 'approved'),
        eq(teacherTimeOff.substituteRequired, true),
        // Include both never-blasted AND previously-blasted-but-unfilled positions
        inArray(teacherTimeOff.subOutreachStatus, ['not_started', 'sent']),
        ne(teacherTimeOff.approvalStatus, 'denied'),
      ))

    if (pending.length === 0) continue
    totalPositions += pending.length

    try {
      const result = await notifyAllSubs(pending.map(p => p.id))
      results.push({ orgId: org.id, tz, today, positions: pending.length, sent: result.sent, errors: result.errors })
    } catch (err) {
      results.push({ orgId: org.id, tz, error: String(err) })
    }
  }

  console.log(`[MORNING BLAST] ${totalPositions} positions across ${results.length} orgs`)
  return NextResponse.json({ positions: totalPositions, orgs: results.length, results })
}
