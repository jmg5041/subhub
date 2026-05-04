'use server'

/**
 * Server Actions for the sub accept/decline deep link page.
 *
 * These actions run WITHOUT requiring the sub to be logged in.
 * The token in the URL acts as the authentication — it's unique per sub per absence.
 *
 * Security: tokens expire after 48 hours and can only be used once.
 */

import { db } from '@/db'
import {
  subNotificationTokens,
  subAssignments,
  assignmentTimeOff,
  teacherTimeOff,
} from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

/**
 * Sub accepts the job.
 * Creates the sub_assignment, marks the absence as filled, marks token used.
 * Redirects to the confirmed page.
 */
export async function acceptSubJob(token: string) {
  const tokenRow = await db.query.subNotificationTokens.findFirst({
    where: eq(subNotificationTokens.token, token),
    with: {
      teacherTimeOff: true,
      substitute: {
        with: { user: true },
      },
    },
  })

  if (!tokenRow) throw new Error('Token not found')
  if (tokenRow.usedAt) throw new Error('Token already used')
  if (new Date() > tokenRow.expiresAt) throw new Error('Token expired')
  if (tokenRow.teacherTimeOff.subOutreachStatus === 'filled') {
    redirect(`/sub/jobs/${token}/confirmed?already_filled=1`)
  }

  const absence = tokenRow.teacherTimeOff

  // Compute total hours
  const [sh, sm] = absence.startTime.split(':').map(Number)
  const [eh, em] = absence.endTime.split(':').map(Number)
  const totalHours = ((eh * 60 + em) - (sh * 60 + sm)) / 60

  // Create the sub assignment
  const [assignment] = await db
    .insert(subAssignments)
    .values({
      organizationId: absence.organizationId,
      schoolId: absence.schoolId,
      substituteId: tokenRow.substituteId,
      date: absence.date,
      startTime: absence.startTime,
      endTime: absence.endTime,
      totalHours: totalHours.toFixed(2),
      status: 'assigned',
      assignedByAdmin: false,
    })
    .returning()

  // Link to the absence
  await db.insert(assignmentTimeOff).values({
    assignmentId: assignment.id,
    timeOffId: absence.id,
  })

  // Mark absence filled
  await db
    .update(teacherTimeOff)
    .set({ subOutreachStatus: 'filled' })
    .where(eq(teacherTimeOff.id, absence.id))

  // Mark token used
  await db
    .update(subNotificationTokens)
    .set({ usedAt: new Date(), action: 'accepted' })
    .where(eq(subNotificationTokens.token, token))

  redirect(`/sub/jobs/${token}/confirmed`)
}

/**
 * Sub declines the job.
 * Marks the token as declined. Other subs still have their own tokens.
 */
export async function declineSubJob(token: string) {
  const tokenRow = await db.query.subNotificationTokens.findFirst({
    where: eq(subNotificationTokens.token, token),
  })

  if (!tokenRow) throw new Error('Token not found')

  await db
    .update(subNotificationTokens)
    .set({ usedAt: new Date(), action: 'declined' })
    .where(eq(subNotificationTokens.token, token))

  redirect(`/sub/jobs/${token}`)
}
