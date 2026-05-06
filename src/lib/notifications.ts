/**
 * Notification utilities — builds messages and sends them to substitutes.
 *
 * Phase 3 delivers email only. SMS and phone are wired up but disabled until
 * Twilio A2P 10DLC registration is complete (Phase 4).
 *
 * Email is sent via Resend. Requires RESEND_API_KEY in environment variables.
 * Without the key, sends are logged to console only (safe for local dev).
 */

import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq, asc, and, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { Resend } from 'resend'
import { sendSms, makeVoiceCall } from './twilio'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// ─── Message builder ──────────────────────────────────────────────────────────

function formatTime(t: string): string {
  // t is "HH:MM:SS" from the DB — convert to "7:30 AM"
  const [hourStr, min] = t.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${min} ${ampm}`
}

function formatDate(d: string): string {
  // d is "YYYY-MM-DD" — convert to "Thursday, June 5"
  const date = new Date(d + 'T12:00:00') // noon avoids timezone shift
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export function buildSubEmailBody(params: {
  schoolName: string
  startDate: string
  endDate: string | null
  startTime: string
  endTime: string
  notesToSub: string | null
  isSpecificallyRequested: boolean
  acceptUrl: string
  declineUrl: string
}): { subject: string; html: string; text: string } {
  const { schoolName, startDate, endDate, startTime, endTime, notesToSub, isSpecificallyRequested, acceptUrl, declineUrl } = params

  const dateStr = endDate && endDate !== startDate
    ? `${formatDate(startDate)} – ${formatDate(endDate)}`
    : formatDate(startDate)
  const timeStr = `${formatTime(startTime)} – ${formatTime(endTime)}`
  const requestedNote = isSpecificallyRequested ? '<p><strong>You have been specifically requested for this position.</strong></p>' : ''
  const requestedNotePlain = isSpecificallyRequested ? 'You have been specifically requested for this position.\n\n' : ''
  const notesSection = notesToSub ? `<p><strong>Notes from the teacher:</strong><br>${notesToSub}</p>` : ''
  const notesPlain = notesToSub ? `Notes from the teacher:\n${notesToSub}\n\n` : ''

  const subject = endDate && endDate !== startDate
    ? `Sub request — ${schoolName} starting ${formatDate(startDate)}`
    : `Sub request — ${schoolName} on ${dateStr}`

  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
      <h2 style="color: #2563eb;">Substitute Request</h2>
      <p><strong>School:</strong> ${schoolName}</p>
      <p><strong>Date:</strong> ${dateStr}</p>
      <p><strong>Time:</strong> ${timeStr}</p>
      ${requestedNote}
      ${notesSection}
      <div style="margin: 32px 0;">
        <a href="${acceptUrl}" style="background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 12px;">Accept</a>
        <a href="${declineUrl}" style="background: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Decline</a>
      </div>
      <p style="color: #6b7280; font-size: 13px;">These links are unique to you. The first substitute to accept gets the position.</p>
    </div>
  `

  const text = `Substitute Request\n\nSchool: ${schoolName}\nDate: ${dateStr}\nTime: ${timeStr}\n\n${requestedNotePlain}${notesPlain}Accept: ${acceptUrl}\nDecline: ${declineUrl}\n\nThese links are unique to you. First to accept gets the position.`

  return { subject, html, text }
}

// ─── Token generator ──────────────────────────────────────────────────────────

export async function generateNotificationToken(
  teacherTimeOffId: string,
  substituteId: string
): Promise<string> {
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours

  await db.insert(schema.subNotificationTokens).values({
    token,
    teacherTimeOffId,
    substituteId,
    expiresAt,
  })

  return token
}

// ─── SMS message builder ─────────────────────────────────────────────────────

export function buildSubSmsBody(params: {
  schoolName: string
  startDate: string
  endDate: string | null
  startTime: string
  endTime: string
  acceptUrl: string
  declineUrl: string
}): string {
  const { schoolName, startDate, endDate, startTime, endTime, acceptUrl, declineUrl } = params
  const dateStr = endDate && endDate !== startDate
    ? `${formatDate(startDate)} – ${formatDate(endDate)}`
    : formatDate(startDate)
  const timeStr = `${formatTime(startTime)}–${formatTime(endTime)}`
  return `Sub needed at ${schoolName} on ${dateStr}, ${timeStr}.\n\nAccept: ${acceptUrl}\nDecline: ${declineUrl}`
}

// ─── Email sender ─────────────────────────────────────────────────────────────

export async function sendSubEmail(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<void> {
  if (!resend) {
    // Dev mode: log instead of sending
    console.log(`[EMAIL] To: ${params.to}`)
    console.log(`[EMAIL] Subject: ${params.subject}`)
    console.log(`[EMAIL] Body: ${params.text}`)
    return
  }

  const { error } = await resend.emails.send({
    from: 'SubHub <no-reply@substitutes.us>',
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  })

  if (error) {
    console.error(`[EMAIL ERROR] Failed to send to ${params.to}:`, error)
  }
}

// ─── Main: notify all available subs ─────────────────────────────────────────

export async function notifyAllSubs(
  teacherTimeOffId: string
): Promise<{ sent: number; errors: string[] }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

  // Load the absence with school info
  const absence = await db.query.teacherTimeOff.findFirst({
    where: eq(schema.teacherTimeOff.id, teacherTimeOffId),
    with: {
      school: true,
      requestedSub: {
        with: { user: true },
      },
    },
  })
  if (!absence) throw new Error(`Absence ${teacherTimeOffId} not found`)

  // Load org notification settings
  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, absence.organizationId),
  })
  if (!org) throw new Error(`Org not found for absence ${teacherTimeOffId}`)

  // Get all subs for this org, sorted by priority rank (lower = called first)
  const priorityRows = await db
    .select()
    .from(schema.subPriorityOrders)
    .where(eq(schema.subPriorityOrders.organizationId, absence.organizationId))
    .orderBy(asc(schema.subPriorityOrders.priorityRank))

  const rankedSubIds = new Set(priorityRows.map(r => r.substituteId))

  // Get all active subs in this org
  const allSubs = await db.query.substitutes.findMany({
    where: eq(schema.substitutes.status, 'active'),
    with: { user: true },
  })

  // Filter to subs who belong to this org and aren't excluded from this school
  const eligibleSubs = allSubs.filter(sub => {
    if (sub.user.organizationId !== absence.organizationId) return false
    const excluded = (sub.excludedFromSchools as string[]) ?? []
    if (excluded.includes(absence.schoolId)) return false
    return true
  })

  // Sort: ranked subs first (by priority rank), then unranked subs
  const rankedSubs = priorityRows
    .map(r => eligibleSubs.find(s => s.id === r.substituteId))
    .filter(Boolean) as typeof eligibleSubs

  const unrankedSubs = eligibleSubs.filter(s => !rankedSubIds.has(s.id))
  const orderedSubs = [...rankedSubs, ...unrankedSubs]

  const isSpecificallyRequested = (sub: typeof orderedSubs[0]) =>
    absence.requestedSubId === sub.id

  // Filter out subs who marked the start date unavailable
  const unavailableRows = orderedSubs.length > 0
    ? await db
        .select({ substituteId: schema.subUnavailability.substituteId })
        .from(schema.subUnavailability)
        .where(and(
          inArray(schema.subUnavailability.substituteId, orderedSubs.map(s => s.id)),
          eq(schema.subUnavailability.date, absence.startDate)
        ))
    : []
  const unavailableIds = new Set(unavailableRows.map(r => r.substituteId))
  const availableSubs = orderedSubs.filter(s => !unavailableIds.has(s.id))

  const errors: string[] = []
  let sent = 0

  for (const sub of availableSubs) {
    if (!sub.user.email) {
      errors.push(`No email for sub ${sub.user.firstName} ${sub.user.lastName}`)
      continue
    }

    try {
      const token = await generateNotificationToken(teacherTimeOffId, sub.id)
      const acceptUrl = `${appUrl}/sub/jobs/${token}?action=accept`
      const declineUrl = `${appUrl}/sub/jobs/${token}?action=decline`

      const sendEmail = org.notifyByEmail !== false
      const sendSmsTxt = org.notifyBySms === true
      const makeCall = org.notifyByPhone === true

      if (sendEmail) {
        const { subject, html, text } = buildSubEmailBody({
          schoolName: absence.school.name,
          startDate: absence.startDate,
          endDate: absence.endDate,
          startTime: absence.startTime,
          endTime: absence.endTime,
          notesToSub: absence.notesToSub,
          isSpecificallyRequested: isSpecificallyRequested(sub),
          acceptUrl,
          declineUrl,
        })
        await sendSubEmail({ to: sub.user.email, subject, html, text })
      }

      if (sendSmsTxt && sub.user.phone) {
        const smsBody = buildSubSmsBody({
          schoolName: absence.school.name,
          startDate: absence.startDate,
          endDate: absence.endDate,
          startTime: absence.startTime,
          endTime: absence.endTime,
          acceptUrl,
          declineUrl,
        })
        await sendSms(sub.user.phone, smsBody)
      }

      if (makeCall && sub.user.phone) {
        await makeVoiceCall(sub.user.phone, token)
      }

      sent++
    } catch (err) {
      errors.push(`Failed for ${sub.user.email}: ${err}`)
    }
  }

  // Mark outreach as sent
  await db
    .update(schema.teacherTimeOff)
    .set({ subOutreachStatus: 'sent' })
    .where(eq(schema.teacherTimeOff.id, teacherTimeOffId))

  return { sent, errors }
}
