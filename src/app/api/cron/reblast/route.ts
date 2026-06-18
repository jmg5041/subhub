import { NextResponse } from 'next/server'
import { db } from '@/db'
import { organizations, teacherTimeOff } from '@/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { reBlastNonDecliners } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Runs at 6:20am Pacific. Two UTC entries cover PDT and PST:
//   20 13 * * * = 6:20am PDT  |  20 14 * * * = 6:20am PST
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allOrgs = await db.select({ id: organizations.id, timezone: organizations.timezone })
    .from(organizations)
    .where(eq(organizations.cronEnabled, true))

  // Process all orgs in parallel — each org is independent
  const orgResults = await Promise.allSettled(
    allOrgs.map(async (org) => {
      const tz = org.timezone ?? 'America/Los_Angeles'
      const localHour = parseInt(
        new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).split(':')[0]
      )
      if (localHour !== 6) return []

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

      if (stillUnfilled.length === 0) return []

      // Re-blast all unfilled positions for this org in parallel
      const positionResults = await Promise.allSettled(
        stillUnfilled.map(async (row) => {
          const result = await reBlastNonDecliners(row.id)
          return { orgId: org.id, tz, id: row.id, sent: result.sent, errors: result.errors }
        })
      )
      return positionResults.map(r =>
        r.status === 'fulfilled'
          ? r.value
          : { orgId: org.id, tz, id: null, sent: 0, errors: [String(r.reason)] }
      )
    })
  )

  const results = orgResults.flatMap(r => r.status === 'fulfilled' ? r.value : [])
  const totalPositions = results.length

  console.log(`[REBLAST] ${totalPositions} unfilled positions across orgs`)
  return NextResponse.json({ positions: totalPositions, results })
}
