import { NextResponse } from 'next/server'
import { db } from '@/db'
import { organizations, teacherTimeOff, subAssignments, assignmentTimeOff } from '@/db/schema'
import { eq, and, isNull, inArray, ne, sql } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Runs at 5:30pm Pacific (00:30 UTC next day). Marks absences whose last day is today
// as completed, which removes them from the dashboard and marks linked sub assignments
// as 'completed' so subs get credit. Fires once per day.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allOrgs = await db.select({ id: organizations.id, timezone: organizations.timezone }).from(organizations)

  const results = []
  let totalCompleted = 0

  for (const org of allOrgs) {
    const tz = org.timezone ?? 'America/Los_Angeles'

    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz })

    // Find today's absences that haven't been completed yet
    const toComplete = await db
      .select({ id: teacherTimeOff.id })
      .from(teacherTimeOff)
      .where(and(
        eq(teacherTimeOff.organizationId, org.id),
        // Match absences whose last day is today: endDate if set, else startDate
        sql`COALESCE(${teacherTimeOff.endDate}, ${teacherTimeOff.startDate}) = ${today}`,
        isNull(teacherTimeOff.completedAt),
        ne(teacherTimeOff.approvalStatus, 'denied'),
      ))

    if (toComplete.length === 0) continue

    const absenceIds = toComplete.map(a => a.id)
    const now = new Date()

    // Stamp completedAt on the absences
    await db
      .update(teacherTimeOff)
      .set({ completedAt: now })
      .where(inArray(teacherTimeOff.id, absenceIds))

    // Find and complete any linked sub assignments
    const links = await db
      .select({ assignmentId: assignmentTimeOff.assignmentId })
      .from(assignmentTimeOff)
      .where(inArray(assignmentTimeOff.timeOffId, absenceIds))

    const assignmentIds = [...new Set(links.map(l => l.assignmentId))]

    if (assignmentIds.length > 0) {
      await db
        .update(subAssignments)
        .set({ status: 'completed', updatedAt: now })
        .where(and(
          inArray(subAssignments.id, assignmentIds),
          ne(subAssignments.status, 'cancelled'),
        ))
    }

    totalCompleted += absenceIds.length
    results.push({ orgId: org.id, tz, today, absences: absenceIds.length, assignments: assignmentIds.length })
  }

  console.log(`[COMPLETE ABSENCES] marked ${totalCompleted} absences complete`)
  return NextResponse.json({ completed: totalCompleted, results })
}
