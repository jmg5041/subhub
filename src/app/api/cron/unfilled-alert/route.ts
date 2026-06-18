import { NextResponse } from 'next/server'
import { db } from '@/db'
import { organizations, teacherTimeOff } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { notifyAdminsUnfilled } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Runs at 6:30am Pacific. Two UTC entries cover PDT and PST:
//   30 13 * * * = 6:30am PDT  |  30 14 * * * = 6:30am PST
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

      const unfilled = await db
        .select({ id: teacherTimeOff.id })
        .from(teacherTimeOff)
        .where(and(
          eq(teacherTimeOff.organizationId, org.id),
          eq(teacherTimeOff.startDate, today),
          eq(teacherTimeOff.approvalStatus, 'approved'),
          eq(teacherTimeOff.substituteRequired, true),
          eq(teacherTimeOff.subOutreachStatus, 'sent'),
        ))

      if (unfilled.length === 0) return []

      // Alert admin for each unfilled position in parallel
      const alertResults = await Promise.allSettled(
        unfilled.map(async (absence) => {
          await notifyAdminsUnfilled(absence.id)
          return { orgId: org.id, tz, absenceId: absence.id, adminAlerted: true }
        })
      )
      return alertResults.map(r =>
        r.status === 'fulfilled'
          ? r.value
          : { orgId: org.id, tz, absenceId: null, adminAlerted: false }
      )
    })
  )

  const results = orgResults.flatMap(r => r.status === 'fulfilled' ? r.value : [])
  const totalUnfilled = results.length

  console.log(`[UNFILLED ALERT] alerted admin for ${totalUnfilled} unfilled positions`)
  return NextResponse.json({ unfilled: totalUnfilled, results })
}
