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

// ─── Admin notification: teacher submitted an absence ────────────────────────

export async function notifyAdminsOfAbsenceRequest(params: {
  orgId: string
  schoolId: string
  teacherName: string
  schoolName: string
  startDate: string
  endDate: string | null
  absenceId: string
}): Promise<void> {
  const { orgId, schoolId, teacherName, schoolName, startDate, endDate, absenceId } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

  // All admin/principal/staff users in this org
  const allAdmins = await db
    .select({ email: schema.users.email, firstName: schema.users.firstName, id: schema.users.id })
    .from(schema.users)
    .where(and(
      eq(schema.users.organizationId, orgId),
      inArray(schema.users.role, ['admin', 'principal', 'staff'])
    ))

  if (allAdmins.length === 0) return

  // Opt-out model: find who has explicitly disabled teacher-submit alerts for this school
  const optedOut = await db
    .select({ userId: schema.userSchoolNotificationPrefs.userId })
    .from(schema.userSchoolNotificationPrefs)
    .where(and(
      eq(schema.userSchoolNotificationPrefs.schoolId, schoolId),
      eq(schema.userSchoolNotificationPrefs.alertOnTeacherSubmit, false)
    ))
  const optedOutIds = new Set(optedOut.map(r => r.userId))

  const admins = allAdmins.filter(u => !optedOutIds.has(u.id))

  if (admins.length === 0) return

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const dateStr = endDate && endDate !== startDate
    ? `${formatDate(startDate)} – ${formatDate(endDate)}`
    : formatDate(startDate)

  const subject = `Sub request — ${teacherName} out ${dateStr}`
  const dashboardUrl = `${appUrl}/dashboard`
  const fillUrl = `${appUrl}/absences/find-sub`

  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #111; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background: #2563eb; padding: 20px 24px;">
        <h1 style="color: white; margin: 0; font-size: 20px;">SubHub</h1>
        <p style="color: #bfdbfe; margin: 4px 0 0; font-size: 13px;">substitutes.us</p>
      </div>
      <div style="padding: 24px;">
        <h2 style="color: #111; margin-top: 0;">Absence Request Submitted</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;">Teacher</td><td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${teacherName}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">School</td><td style="padding: 8px 0; font-size: 14px;">${schoolName}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Absence date</td><td style="padding: 8px 0; font-size: 14px;">${dateStr}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Submitted</td><td style="padding: 8px 0; font-size: 14px;">${today}</td></tr>
        </table>
        <p style="font-size: 14px; color: #374151;">Subs will be automatically notified the evening before or morning of the absence. You can also assign a sub manually or cancel this request from your dashboard.</p>
        <div style="margin: 24px 0; display: flex; gap: 12px;">
          <a href="${dashboardUrl}" style="background: #2563eb; color: white; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; margin-right: 12px;">View Dashboard</a>
          <a href="${fillUrl}" style="background: #f3f4f6; color: #374151; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">Find a Sub</a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">You're receiving this because you're listed as an admin at ${schoolName}. Manage your notification preferences in your SubHub profile.</p>
      </div>
    </div>
  `
  const text = `Absence request submitted\n\nTeacher: ${teacherName}\nSchool: ${schoolName}\nAbsence date: ${dateStr}\nSubmitted: ${today}\n\nSubs will be automatically notified before the absence.\n\nDashboard: ${dashboardUrl}\nFind a sub: ${fillUrl}`

  for (const admin of admins) {
    if (!admin.email) continue
    await sendSubEmail({ to: admin.email, subject, html, text })
  }
}

// ─── Main: notify all available subs ─────────────────────────────────────────

// ─── Admin alert: absence still unfilled ─────────────────────────────────────

export async function notifyAdminsUnfilled(teacherTimeOffId: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

  const [row] = await db
    .select({
      organizationId: schema.teacherTimeOff.organizationId,
      schoolId: schema.teacherTimeOff.schoolId,
      startDate: schema.teacherTimeOff.startDate,
      schoolName: schema.schools.name,
      teacherFirst: schema.users.firstName,
      teacherLast: schema.users.lastName,
    })
    .from(schema.teacherTimeOff)
    .innerJoin(schema.schools, eq(schema.teacherTimeOff.schoolId, schema.schools.id))
    .innerJoin(schema.employees, eq(schema.teacherTimeOff.employeeId, schema.employees.id))
    .innerJoin(schema.users, eq(schema.employees.userId, schema.users.id))
    .where(eq(schema.teacherTimeOff.id, teacherTimeOffId))

  if (!row) return

  // All admin/principal/staff in the org
  const allAdmins = await db
    .select({ email: schema.users.email, id: schema.users.id })
    .from(schema.users)
    .where(and(
      eq(schema.users.organizationId, row.organizationId),
      inArray(schema.users.role, ['admin', 'principal', 'staff'])
    ))

  // Opt-out model: find who disabled unfilled alerts for this specific school
  const optedOut = await db
    .select({ userId: schema.userSchoolNotificationPrefs.userId })
    .from(schema.userSchoolNotificationPrefs)
    .where(and(
      eq(schema.userSchoolNotificationPrefs.schoolId, row.schoolId),
      eq(schema.userSchoolNotificationPrefs.alertOnUnfilled, false)
    ))
  const optedOutIds = new Set(optedOut.map(r => r.userId))

  const admins = allAdmins.filter(u => !optedOutIds.has(u.id))

  const teacherName = `${row.teacherFirst} ${row.teacherLast}`
  const dateStr = formatDate(row.startDate)
  const subject = `No sub yet — ${teacherName} is out ${dateStr}`
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
      <h2 style="color: #dc2626;">Still No Substitute</h2>
      <p><strong>${teacherName}</strong> is absent on <strong>${dateStr}</strong> at ${row.schoolName} and no substitute has accepted yet.</p>
      <p>A second round of notifications has been sent to available subs. You may also want to assign someone manually.</p>
      <div style="margin: 24px 0;">
        <a href="${appUrl}/absences/find-sub" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Assign a Sub Manually</a>
      </div>
    </div>
  `
  const text = `No sub yet for ${teacherName} on ${dateStr} at ${row.schoolName}.\n\nA second round of notifications has been sent.\n\nAssign manually: ${appUrl}/absences/find-sub`

  for (const admin of admins) {
    if (!admin.email) continue
    await sendSubEmail({ to: admin.email, subject, html, text })
  }
}

// ─── Re-blast: notify subs who haven't explicitly declined ───────────────────

export async function reBlastNonDecliners(
  teacherTimeOffId: string
): Promise<{ sent: number; errors: string[] }> {
  const declinedRows = await db
    .select({ substituteId: schema.subNotificationTokens.substituteId })
    .from(schema.subNotificationTokens)
    .where(and(
      eq(schema.subNotificationTokens.teacherTimeOffId, teacherTimeOffId),
      eq(schema.subNotificationTokens.action, 'declined')
    ))
  const skipSubIds = new Set(declinedRows.map(r => r.substituteId))
  return notifyAllSubs(teacherTimeOffId, { skipSubIds })
}

// ─── Main: notify all available subs ─────────────────────────────────────────

export async function notifyAllSubs(
  teacherTimeOffId: string,
  options: { skipSubIds?: Set<string> } = {}
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

  // Get priority order for THIS school specifically
  const priorityRows = await db
    .select()
    .from(schema.subPriorityOrders)
    .where(and(
      eq(schema.subPriorityOrders.organizationId, absence.organizationId),
      eq(schema.subPriorityOrders.schoolId, absence.schoolId)
    ))
    .orderBy(asc(schema.subPriorityOrders.priorityRank))

  const rankedSubIds = new Set(priorityRows.map(r => r.substituteId))

  // Get only subs assigned to this school (active assignments)
  const schoolAssignments = await db
    .select({ substituteId: schema.subSchoolAssignments.substituteId })
    .from(schema.subSchoolAssignments)
    .where(and(
      eq(schema.subSchoolAssignments.schoolId, absence.schoolId),
      eq(schema.subSchoolAssignments.organizationId, absence.organizationId),
      eq(schema.subSchoolAssignments.status, 'active')
    ))
  const schoolSubIds = new Set(schoolAssignments.map(r => r.substituteId))

  // Get active subs who are assigned to this school
  const allSubs = await db.query.substitutes.findMany({
    where: eq(schema.substitutes.status, 'active'),
    with: { user: true },
  })

  const eligibleSubs = allSubs.filter(sub => {
    if (sub.user.organizationId !== absence.organizationId) return false
    if (!schoolSubIds.has(sub.id)) return false  // must be assigned to this school
    return true
  })

  console.log(`[BLAST] absenceId=${teacherTimeOffId} schoolId=${absence.schoolId} orgId=${absence.organizationId}`)
  console.log(`[BLAST] schoolSubIds=${JSON.stringify([...schoolSubIds])}`)
  console.log(`[BLAST] allSubs count=${allSubs.length}`)
  console.log(`[BLAST] eligibleSubs count=${eligibleSubs.length} ids=${JSON.stringify(eligibleSubs.map(s => s.id))}`)

  // Sort: ranked subs first (by priority rank), then unranked subs
  const rankedSubs = priorityRows
    .map(r => eligibleSubs.find(s => s.id === r.substituteId))
    .filter(Boolean) as typeof eligibleSubs

  const unrankedSubs = eligibleSubs.filter(s => !rankedSubIds.has(s.id))
  const orderedSubs = [...rankedSubs, ...unrankedSubs]
  console.log(`[BLAST] orderedSubs count=${orderedSubs.length}`)

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

  // Filter out subs already booked for another job on this date
  const bookedRows = orderedSubs.length > 0
    ? await db
        .select({ substituteId: schema.subAssignments.substituteId })
        .from(schema.subAssignments)
        .where(and(
          inArray(schema.subAssignments.substituteId, orderedSubs.map(s => s.id)),
          eq(schema.subAssignments.date, absence.startDate),
          eq(schema.subAssignments.status, 'assigned')
        ))
    : []
  const bookedIds = new Set(bookedRows.map(r => r.substituteId))

  console.log(`[BLAST] unavailableIds=${JSON.stringify([...unavailableIds])}`)
  console.log(`[BLAST] bookedIds=${JSON.stringify([...bookedIds])}`)

  const skipSubIds = options.skipSubIds ?? new Set<string>()
  const availableSubs = orderedSubs.filter(s =>
    !unavailableIds.has(s.id) && !bookedIds.has(s.id) && !skipSubIds.has(s.id)
  )
  console.log(`[BLAST] availableSubs count=${availableSubs.length}`)

  const errors: string[] = []
  let sent = 0

  for (const sub of availableSubs) {
    if (!sub.user.email) {
      errors.push(`No email for sub ${sub.user.firstName} ${sub.user.lastName}`)
      continue
    }

    console.log(`[BLAST] Processing sub ${sub.user.email} sendEmail=${org.notifyByEmail} sendSms=${org.notifyBySms} makeCall=${org.notifyByPhone}`)

    try {
      const token = await generateNotificationToken(teacherTimeOffId, sub.id)
      console.log(`[BLAST] Token generated: ${token}`)
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
      console.error(`[BLAST ERROR] Failed for ${sub.user.email}:`, err)
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
