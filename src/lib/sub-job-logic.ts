import { db } from '@/db'
import {
  subNotificationTokens,
  subAssignments,
  assignmentTimeOff,
  teacherTimeOff,
} from '@/db/schema'
import { eq } from 'drizzle-orm'
import { countWeekdays } from '@/lib/date-utils'

export type AcceptResult =
  | { success: true; schoolName: string; startDate: string; endDate: string | null; startTime: string; endTime: string }
  | { error: string; alreadyFilled?: boolean; expired?: boolean; alreadyUsed?: boolean }

export type DeclineResult =
  | { success: true }
  | { error: string }

// Shared accept logic — no redirect, returns result. Used by both the web action and Twilio webhook.
export async function performAcceptJob(token: string): Promise<AcceptResult> {
  const tokenRow = await db.query.subNotificationTokens.findFirst({
    where: eq(subNotificationTokens.token, token),
    with: {
      teacherTimeOff: { with: { school: true } },
    },
  })

  if (!tokenRow) return { error: 'Token not found' }
  if (tokenRow.usedAt) return { error: 'Token already used', alreadyUsed: true }
  if (new Date() > tokenRow.expiresAt) return { error: 'Token expired', expired: true }
  if (tokenRow.teacherTimeOff.subOutreachStatus === 'filled') {
    return { error: 'Position already filled', alreadyFilled: true }
  }

  const absence = tokenRow.teacherTimeOff

  const [sh, sm] = absence.startTime.split(':').map(Number)
  const [eh, em] = absence.endTime.split(':').map(Number)
  const dailyHours = ((eh * 60 + em) - (sh * 60 + sm)) / 60
  const totalHours = dailyHours * countWeekdays(absence.startDate, absence.endDate)

  const [assignment] = await db
    .insert(subAssignments)
    .values({
      organizationId: absence.organizationId,
      schoolId: absence.schoolId,
      substituteId: tokenRow.substituteId,
      date: absence.startDate,
      startTime: absence.startTime,
      endTime: absence.endTime,
      totalHours: totalHours.toFixed(2),
      status: 'assigned',
      assignedByAdmin: false,
    })
    .returning()

  await db.insert(assignmentTimeOff).values({
    assignmentId: assignment.id,
    timeOffId: absence.id,
  })

  await db
    .update(teacherTimeOff)
    .set({ subOutreachStatus: 'filled' })
    .where(eq(teacherTimeOff.id, absence.id))

  await db
    .update(subNotificationTokens)
    .set({ usedAt: new Date(), action: 'accepted' })
    .where(eq(subNotificationTokens.token, token))

  return {
    success: true,
    schoolName: tokenRow.teacherTimeOff.school.name,
    startDate: absence.startDate,
    endDate: absence.endDate,
    startTime: absence.startTime,
    endTime: absence.endTime,
  }
}

export async function performDeclineJob(token: string): Promise<DeclineResult> {
  const tokenRow = await db.query.subNotificationTokens.findFirst({
    where: eq(subNotificationTokens.token, token),
  })

  if (!tokenRow) return { error: 'Token not found' }

  await db
    .update(subNotificationTokens)
    .set({ usedAt: new Date(), action: 'declined' })
    .where(eq(subNotificationTokens.token, token))

  return { success: true }
}
