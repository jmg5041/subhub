import { NextResponse } from 'next/server'
import { db } from '@/db'
import { organizations, teacherTimeOff } from '@/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { reBlastNonDecliners } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Runs at 6:20am Pacific (14:20 UTC). Re-notifies subs who haven't declined for any
// position still unfilled after the morning blast. Fires once per day.
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

    const stillUnfilled = await db
      .select({ id: teacherTimeOff.id })
      .from(teacherTimeOff)
      .where(and(
        eq(teacherTimeOff.organizationId, org.id),
        eq(teacherTimeOff.startDate, today),
        eq(teacherTimeOff.approvalStatus, 'approved'),
        eq(teacherTimeOff.substituteRequired, true),
        eq(teacherTimeOff.subOutreachStatus, 'sent'),
        ne(teacherTimeOff.approvalStatus, 'denied'),
      ))

    if (stillUnfilled.length === 0) continue
    totalPositions += stillUnfilled.length

    for (const row of stillUnfilled) {
      try {
        const result = await reBlastNonDecliners(row.id)
        results.push({ orgId: org.id, tz, id: row.id, sent: result.sent, errors: result.errors })
      } catch (err) {
        results.push({ orgId: org.id, tz, id: row.id, error: String(err) })
      }
    }
  }

  console.log(`[REBLAST] ${totalPositions} unfilled positions across orgs`)
  return NextResponse.json({ positions: totalPositions, results })
}
