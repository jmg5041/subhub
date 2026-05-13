import { NextResponse } from 'next/server'
import { db } from '@/db'
import { organizations, teacherTimeOff } from '@/db/schema'
import { eq, and, ne, inArray } from 'drizzle-orm'
import { notifyAllSubs } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Runs each morning at 6am Pacific (14:00 UTC). Blasts ALL unfilled positions for today —
// both positions never blasted (not_started) AND positions blasted last night that still
// have no sub (sent). The 6:20am re-blast handles anything still unfilled after this.
// Fires once per day — no localHour check needed.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allOrgs = await db.select({ id: organizations.id, timezone: organizations.timezone }).from(organizations)

  const results = []
  let totalPositions = 0

  for (const org of allOrgs) {
    const tz = org.timezone ?? 'America/Los_Angeles'

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
