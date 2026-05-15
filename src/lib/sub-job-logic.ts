/**
 * Shared accept/decline logic for substitute job tokens.
 *
 * WHY THIS FILE EXISTS
 * Two separate paths lead to a sub accepting a job:
 *   1. Web link — sub clicks Accept in their email or dashboard (/sub/jobs/[token]/actions.ts)
 *   2. Phone IVR — sub presses a digit during a Twilio call (api/twilio/gather/[token]/route.ts)
 *
 * Both paths need the same database operations (create assignment, mark filled, send
 * confirmation email, auto-decline other same-date tokens). This file contains that
 * shared logic so it doesn't get duplicated and drift out of sync.
 *
 * The difference between the two paths:
 *   - performAcceptJob: returns a typed result object (IVR needs to speak the outcome)
 *   - acceptSubJob (in actions.ts): calls redirect() directly (web path goes to confirmed page)
 *
 * RACE CONDITION PROTECTION
 * The token update uses WHERE usedAt IS NULL so only one concurrent accept wins at the
 * database level. Two simultaneous accepts (e.g. phone + web button at same instant)
 * cannot both succeed — the second one gets back an empty result and bails out.
 *
 * AUTO-DECLINE
 * After a sub accepts any one position, all their other same-date unused tokens are
 * immediately marked as declined. This prevents a sub from being double-booked on
 * the same day.
 */

import { db } from '@/db'
import {
  subNotificationTokens,
  subAssignments,
  assignmentTimeOff,
  teacherTimeOff,
  substitutes,
  users,
} from '@/db/schema'
import { and, eq, inArray, isNull } from 'drizzle-orm'
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

export type AcceptResult =
  | { success: true; schoolName: string; teacherName: string | null; startDate: string; endDate: string | null; startTime: string; endTime: string }
  | { error: string; alreadyFilled?: boolean; expired?: boolean; alreadyUsed?: boolean }

export type DeclineResult =
  | { success: true }
  | { error: string }

// Shared accept logic — no redirect, returns result. Used by both the web action and Twilio webhook.
export async function performAcceptJob(token: string): Promise<AcceptResult> {
  const tokenRow = await db.query.subNotificationTokens.findFirst({
    where: eq(subNotificationTokens.token, token),
    with: {
      teacherTimeOff: { with: { school: true, employee: { with: { user: true } } } },
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

  // Atomic claim — only succeeds if not already used (prevents race condition double-booking)
  const [claimed] = await db
    .update(subNotificationTokens)
    .set({ usedAt: new Date(), action: 'accepted' })
    .where(and(eq(subNotificationTokens.token, token), isNull(subNotificationTokens.usedAt)))
    .returning({ token: subNotificationTokens.token })

  if (!claimed) return { error: 'Token already used', alreadyUsed: true }

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
  const subUser = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(substitutes)
    .innerJoin(users, eq(substitutes.userId, users.id))
    .where(eq(substitutes.id, tokenRow.substituteId))
    .limit(1)
    .then(rows => rows[0])

  const teacherUser = tokenRow.teacherTimeOff.employee?.user
  const teacherName = teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : null

  if (subUser?.email) {
    const schoolName = tokenRow.teacherTimeOff.school.name
    const dateStr = absence.endDate && absence.endDate !== absence.startDate
      ? `${formatDate(absence.startDate)} – ${formatDate(absence.endDate)}`
      : formatDate(absence.startDate)
    const timeStr = `${formatTime(absence.startTime)} – ${formatTime(absence.endTime)}`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'
    await sendSubEmail({
      to: subUser.email,
      subject: `Confirmed: Sub position at ${schoolName} on ${formatDate(absence.startDate)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #111; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <div style="background: #2563eb; padding: 20px 24px;">
            <h1 style="color: white; margin: 0; font-size: 20px;">SubHub</h1>
            <p style="color: #bfdbfe; margin: 4px 0 0; font-size: 13px;">substitutes.us</p>
          </div>
          <div style="padding: 24px;">
            <h2 style="color: #16a34a; margin-top: 0;">You're confirmed!</h2>
            <p>Hi ${subUser.firstName}, you've accepted the following substitute teaching position:</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px; width: 80px;">School</td><td style="padding: 6px 0; font-size: 14px; font-weight: 600;">${schoolName}</td></tr>
              ${teacherName ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Teacher</td><td style="padding: 6px 0; font-size: 14px;">${teacherName}</td></tr>` : ''}
              <tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Date</td><td style="padding: 6px 0; font-size: 14px;">${dateStr}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Time</td><td style="padding: 6px 0; font-size: 14px;">${timeStr}</td></tr>
            </table>
            <p style="color: #374151; font-size: 14px;">Please arrive a few minutes early and check in at the front office.</p>
            <a href="${appUrl}/sub/dashboard" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; margin-top: 8px;">View My Dashboard</a>
          </div>
        </div>
      `,
      text: `You're confirmed!\n\nSchool: ${schoolName}${teacherName ? `\nTeacher: ${teacherName}` : ''}\nDate: ${dateStr}\nTime: ${timeStr}\n\nPlease arrive a few minutes early and check in at the front office.\n\nView your dashboard: ${appUrl}/sub/dashboard`,
    }).catch(() => {})
  }

  return {
    success: true,
    schoolName: tokenRow.teacherTimeOff.school.name,
    teacherName,
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
