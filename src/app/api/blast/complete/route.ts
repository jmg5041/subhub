/**
 * Complete absences — 5:30pm stamp for absences whose last day is today.
 * Marks them completed and credits the sub assignment.
 */

import { NextResponse } from 'next/server'
import { verifyQStashRequest } from '@/lib/qstash'
import { db } from '@/db'
import { organizations, teacherTimeOff, subAssignments, assignmentTimeOff } from '@/db/schema'
import { eq, and, isNull, inArray, ne, sql } from 'drizzle-orm'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  let orgId: string
  try {
    ({ orgId } = await verifyQStashRequest(req))
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { timezone: true },
  })

  const tz = org?.timezone ?? 'America/Los_Angeles'
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz })

  const toComplete = await db
    .select({ id: teacherTimeOff.id })
    .from(teacherTimeOff)
    .where(and(
      eq(teacherTimeOff.organizationId, orgId),
      sql`COALESCE(${teacherTimeOff.endDate}, ${teacherTimeOff.startDate}) = ${today}`,
      isNull(teacherTimeOff.completedAt),
      ne(teacherTimeOff.approvalStatus, 'denied'),
    ))

  if (toComplete.length === 0) return NextResponse.json({ orgId, completed: 0 })

  const absenceIds = toComplete.map(a => a.id)
  const now = new Date()

  await db
    .update(teacherTimeOff)
    .set({ completedAt: now })
    .where(inArray(teacherTimeOff.id, absenceIds))

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

  console.log(`[COMPLETE] org=${orgId} today=${today} absences=${absenceIds.length} assignments=${assignmentIds.length}`)
  return NextResponse.json({ orgId, today, completed: absenceIds.length, assignments: assignmentIds.length })
}
