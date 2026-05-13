import { NextResponse } from 'next/server'
import { db } from '@/db'
import { organizations, teacherTimeOff } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { notifyAdminsUnfilled } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Runs at 6:30am Pacific. Two UTC entries cover PDT and PST:
//   30 13 * * * = 6:30am PDT  |  30 14 * * * = 6:30am PST
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allOrgs = await db.select({ id: organizations.id, timezone: organizations.timezone }).from(organizations)

  const results = []
  let totalUnfilled = 0

  for (const org of allOrgs) {
    const tz = org.timezone ?? 'America/Los_Angeles'
    const localHour = parseInt(
      new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).split(':')[0]
    )
    if (localHour !== 6) continue

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

    if (unfilled.length === 0) continue
    totalUnfilled += unfilled.length

    for (const absence of unfilled) {
      try {
        await notifyAdminsUnfilled(absence.id)
        results.push({ orgId: org.id, tz, absenceId: absence.id, adminAlerted: true })
      } catch (err) {
        results.push({ orgId: org.id, tz, absenceId: absence.id, error: String(err) })
      }
    }
  }

  console.log(`[UNFILLED ALERT] alerted admin for ${totalUnfilled} unfilled positions`)
  return NextResponse.json({ unfilled: totalUnfilled, results })
}
