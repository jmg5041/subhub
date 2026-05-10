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
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { countWeekdays } from '@/lib/date-utils'
import { sendSubEmail } from '@/lib/notifications'

function formatTime(t: string): string {
  const [hourStr, min] = t.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${min} ${ampm}`
}

function formatDate(d: string): string {
  const date = new Date(d + 'T12:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

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

  // Compute total hours (daily hours × school days)
  const [sh, sm] = absence.startTime.split(':').map(Number)
  const [eh, em] = absence.endTime.split(':').map(Number)
  const dailyHours = ((eh * 60 + em) - (sh * 60 + sm)) / 60
  const totalHours = dailyHours * countWeekdays(absence.startDate, absence.endDate)

  // Create the sub assignment
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

  // Auto-decline all other same-date unused tokens for this sub
  const remainingTokens = await db.query.subNotificationTokens.findMany({
    where: and(
      eq(subNotificationTokens.substituteId, tokenRow.substituteId),
      isNull(subNotificationTokens.usedAt),
    ),
    with: { teacherTimeOff: true },
  })
  const toDecline = remainingTokens
    .filter(t => t.teacherTimeOff.startDate === absence.startDate && t.token !== token)
    .map(t => t.token)
  if (toDecline.length > 0) {
    await db
      .update(subNotificationTokens)
      .set({ usedAt: new Date(), action: 'declined' })
      .where(inArray(subNotificationTokens.token, toDecline))
  }

  // Send confirmation email to the sub
  const sub = tokenRow.substitute
  if (sub?.user?.email) {
    const school = await db.query.schools.findFirst({ where: (s, { eq }) => eq(s.id, absence.schoolId) })
    const schoolName = school?.name ?? 'your school'
    const dateStr = absence.endDate && absence.endDate !== absence.startDate
      ? `${formatDate(absence.startDate)} – ${formatDate(absence.endDate)}`
      : formatDate(absence.startDate)
    const timeStr = `${formatTime(absence.startTime)} – ${formatTime(absence.endTime)}`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'
    await sendSubEmail({
      to: sub.user.email,
      subject: `Confirmed: Sub position at ${schoolName} on ${formatDate(absence.startDate)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #111; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <div style="background: #2563eb; padding: 20px 24px;">
            <h1 style="color: white; margin: 0; font-size: 20px;">SubHub</h1>
            <p style="color: #bfdbfe; margin: 4px 0 0; font-size: 13px;">substitutes.us</p>
          </div>
          <div style="padding: 24px;">
            <h2 style="color: #16a34a; margin-top: 0;">You're confirmed!</h2>
            <p>Hi ${sub.user.firstName}, you've accepted the following substitute teaching position:</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px; width: 60px;">School</td><td style="padding: 6px 0; font-size: 14px; font-weight: 600;">${schoolName}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Date</td><td style="padding: 6px 0; font-size: 14px;">${dateStr}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Time</td><td style="padding: 6px 0; font-size: 14px;">${timeStr}</td></tr>
            </table>
            <p style="color: #374151; font-size: 14px;">Please arrive a few minutes early and check in at the front office.</p>
            <a href="${appUrl}/sub/dashboard" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; margin-top: 8px;">View My Dashboard</a>
          </div>
        </div>
      `,
      text: `You're confirmed!\n\nSchool: ${schoolName}\nDate: ${dateStr}\nTime: ${timeStr}\n\nPlease arrive a few minutes early and check in at the front office.\n\nView your dashboard: ${appUrl}/sub/dashboard`,
    }).catch(() => {})
  }

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
