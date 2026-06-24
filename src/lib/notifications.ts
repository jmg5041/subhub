/**
 * Notification system — the heart of SubHub's substitute outreach.
 *
 * DESIGN: Sub-centric bundled blasts
 * ------------------------------------
 * When multiple positions are open on the same date, each substitute receives
 * exactly ONE notification listing ALL positions they're eligible for. This
 * prevents a sub who works at two schools from getting two simultaneous calls.
 *
 * The main entry point is `notifyAllSubs(teacherTimeOffIds[])`.
 * Call it with an array of absence IDs for the same date. It:
 *   1. Builds a pool of eligible subs per absence (via sub_school_assignments)
 *   2. Inverts to: per sub → which absences are they eligible for?
 *   3. Generates one UUID token per (sub, absence) pair
 *   4. Sends ONE email + ONE SMS + ONE phone call per sub
 *
 * TOKEN SYSTEM
 * Each sub_notification_token row = one sub's claim on one absence.
 * Tokens expire in 48h. Accepting marks usedAt; auto-decline marks all other
 * same-date tokens for that sub as declined to prevent double-booking.
 *
 * CHANNELS (controlled by org settings: notifyByEmail / notifyBySms / notifyByPhone)
 *   Email: full details + Accept/Decline buttons per position
 *   SMS:   single position → direct links; multiple → numbered list + dashboard URL
 *   Phone: Twilio IVR (see voice/[token]/route.ts and gather/[token]/route.ts)
 *
 * SENDING
 * Email goes through Resend (RESEND_API_KEY env var required).
 * Without the key, emails are logged to console — safe for local dev.
 * SMS/voice go through Twilio (TWILIO_* env vars).
 */

import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq, asc, and, inArray, isNull } from 'drizzle-orm'
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

// ─── Bundled email builder (1 or N positions) ────────────────────────────────

type PositionEmailParams = {
  schoolName: string
  teacherName: string | null
  startDate: string
  endDate: string | null
  startTime: string
  endTime: string
  notesToSub: string | null
  acceptUrl: string
  declineUrl: string
}

export function buildBundledEmailBody(params: {
  positions: PositionEmailParams[]
  isSpecificallyRequested: boolean
}): { subject: string; html: string; text: string } {
  const { positions, isSpecificallyRequested } = params
  const first = positions[0]
  const dateStr = first.endDate && first.endDate !== first.startDate
    ? `${formatDate(first.startDate)} – ${formatDate(first.endDate)}`
    : formatDate(first.startDate)

  const subject = positions.length === 1
    ? `Sub request — ${first.schoolName} on ${dateStr}`
    : `${positions.length} sub positions available — ${dateStr}`

  const requestedNote = isSpecificallyRequested
    ? '<p style="color:#b45309;font-weight:600;">You have been specifically requested for one of these positions.</p>'
    : ''

  const positionBlocks = positions.map((p, i) => {
    const pDateStr = p.endDate && p.endDate !== p.startDate
      ? `${formatDate(p.startDate)} – ${formatDate(p.endDate)}`
      : formatDate(p.startDate)
    const timeStr = `${formatTime(p.startTime)} – ${formatTime(p.endTime)}`
    const notesHtml = p.notesToSub
      ? `<p style="font-size:13px;color:#374151;margin:8px 0 0;"><strong>Notes:</strong> ${p.notesToSub}</p>`
      : ''
    const posLabel = positions.length > 1 ? `<div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Position ${i + 1}</div>` : ''
    const teacherLine = p.teacherName ? `<div style="font-size:13px;color:#374151;margin:1px 0;">Sub for: ${p.teacherName}</div>` : ''
    return `
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:12px 0;">
        ${posLabel}
        <div style="font-weight:600;font-size:15px;color:#111;">${p.schoolName}</div>
        ${teacherLine}
        <div style="font-size:13px;color:#6b7280;margin:2px 0 8px;">${pDateStr} · ${timeStr}</div>
        ${notesHtml}
        <div style="margin-top:12px;">
          <a href="${p.acceptUrl}" style="background:#16a34a;color:white;padding:9px 18px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;margin-right:8px;">Accept</a>
          <a href="${p.declineUrl}" style="background:#f3f4f6;color:#374151;padding:9px 18px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;">Decline</a>
        </div>
      </div>`
  }).join('')

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <div style="background:#2563eb;padding:20px 24px;">
        <h1 style="color:white;margin:0;font-size:20px;">SubHub</h1>
        <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">substitutes.us</p>
      </div>
      <div style="padding:24px;">
        <h2 style="margin-top:0;color:#111;">${positions.length === 1 ? 'Substitute Request' : `${positions.length} Positions Available`}</h2>
        ${requestedNote}
        ${positionBlocks}
        <p style="color:#6b7280;font-size:12px;margin-top:16px;">These links are unique to you. The first substitute to accept each position gets it.</p>
      </div>
    </div>`

  const textPositions = positions.map((p, i) => {
    const pDateStr = p.endDate && p.endDate !== p.startDate
      ? `${formatDate(p.startDate)} – ${formatDate(p.endDate)}`
      : formatDate(p.startDate)
    const label = positions.length > 1 ? `Position ${i + 1}: ` : ''
    const teacherPart = p.teacherName ? ` (sub for ${p.teacherName})` : ''
    return `${label}${p.schoolName}${teacherPart} — ${pDateStr}, ${formatTime(p.startTime)}–${formatTime(p.endTime)}\nAccept: ${p.acceptUrl}\nDecline: ${p.declineUrl}${p.notesToSub ? `\nNotes: ${p.notesToSub}` : ''}`
  }).join('\n\n')

  const text = `${subject}\n\n${textPositions}\n\nThese links are unique to you. First to accept gets the position.`

  return { subject, html, text }
}

// ─── Bundled SMS builder ──────────────────────────────────────────────────────

type PositionSmsParams = {
  schoolName: string
  teacherName: string | null
  startDate: string
  startTime: string
  endTime: string
  acceptUrl: string
  declineUrl: string
}

export function buildBundledSmsBody(params: {
  positions: PositionSmsParams[]
  dashboardUrl: string
}): string {
  const { positions, dashboardUrl } = params
  if (positions.length === 1) {
    const p = positions[0]
    const dateStr = formatDate(p.startDate)
    const timeStr = `${formatTime(p.startTime)}–${formatTime(p.endTime)}`
    const forTeacher = p.teacherName ? ` for ${p.teacherName}` : ''
    return `Sub needed${forTeacher} at ${p.schoolName} on ${dateStr}, ${timeStr}.\n\nAccept: ${p.acceptUrl}\nDecline: ${p.declineUrl}`
  }
  const dateStr = formatDate(positions[0].startDate)
  const list = positions.map((p, i) => {
    const forTeacher = p.teacherName ? ` (${p.teacherName})` : ''
    return `${i + 1}. ${p.schoolName}${forTeacher} — ${formatTime(p.startTime)}–${formatTime(p.endTime)}`
  }).join('\n')
  return `SubHub: ${positions.length} positions available ${dateStr}.\n\n${list}\n\nRespond: ${dashboardUrl}`
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
  return notifyAllSubs([teacherTimeOffId], { skipSubIds })
}

// ─── Main: notify all available subs (sub-centric, supports multi-position bundles) ──

export async function notifyAllSubs(
  teacherTimeOffIds: string[],
  options: { skipSubIds?: Set<string> } = {}
): Promise<{ sent: number; errors: string[]; positionCount: number }> {
  if (teacherTimeOffIds.length === 0) return { sent: 0, errors: [], positionCount: 0 }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

  // Load all absences with school info
  const absences = (await Promise.all(
    teacherTimeOffIds.map(id =>
      db.query.teacherTimeOff.findFirst({
        where: eq(schema.teacherTimeOff.id, id),
        with: { school: true, requestedSub: { with: { user: true } }, employee: { with: { user: true } } },
      })
    )
  )).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof db.query.teacherTimeOff.findFirst>> & { school: { name: string; id: string }; requestedSub: { id: string } | null; employee: { user: { firstName: string; lastName: string } } | null }>[]

  if (absences.length === 0) return { sent: 0, errors: [], positionCount: 0 }

  const orgId = absences[0].organizationId
  const absenceDate = absences[0].startDate  // all absences in a bundle are same-date

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, orgId),
  })
  if (!org) return { sent: 0, errors: ['Org not found'], positionCount: 0 }

  // Build the sub pool.
  // Default (priorityCallingEnabled = false): all active subs assigned to the school
  // via sub_school_assignments. No setup required — anyone hired goes into the blast.
  // Opt-in (priorityCallingEnabled = true): use sub_priority_orders for that school,
  // falling back to the open pool if no ranked list has been saved yet.
  const schoolIds = [...new Set(absences.map(a => a.schoolId))]

  const schoolSettings = await db
    .select({ id: schema.schools.id, priorityCallingEnabled: schema.schools.priorityCallingEnabled })
    .from(schema.schools)
    .where(inArray(schema.schools.id, schoolIds))

  const priorityEnabledBySchool = new Map(schoolSettings.map(s => [s.id, s.priorityCallingEnabled]))
  const prioritySchoolIds = schoolIds.filter(id => priorityEnabledBySchool.get(id))

  const [priorityRows, openPoolRows] = await Promise.all([
    prioritySchoolIds.length > 0
      ? db
          .select()
          .from(schema.subPriorityOrders)
          .where(and(
            eq(schema.subPriorityOrders.organizationId, orgId),
            inArray(schema.subPriorityOrders.schoolId, prioritySchoolIds)
          ))
          .orderBy(asc(schema.subPriorityOrders.priorityRank))
      : Promise.resolve([]),
    // Fetch open pool for all schools (used as fallback too if priority list is empty)
    db
      .select({ substituteId: schema.subSchoolAssignments.substituteId, schoolId: schema.subSchoolAssignments.schoolId })
      .from(schema.subSchoolAssignments)
      .where(and(
        eq(schema.subSchoolAssignments.organizationId, orgId),
        inArray(schema.subSchoolAssignments.schoolId, schoolIds),
        eq(schema.subSchoolAssignments.status, 'active')
      )),
  ])

  const openPoolBySchool = new Map<string, string[]>()
  for (const row of openPoolRows) {
    const list = openPoolBySchool.get(row.schoolId) ?? []
    list.push(row.substituteId)
    openPoolBySchool.set(row.schoolId, list)
  }

  const priorityBySchool = new Map<string, typeof priorityRows>()
  for (const row of priorityRows) {
    if (!row.schoolId) continue
    const list = priorityBySchool.get(row.schoolId) ?? []
    list.push(row)
    priorityBySchool.set(row.schoolId, list)
  }

  // Per-absence pool: priority order if enabled + ranked list exists, else all assigned subs
  const absenceSubPools = new Map<string, Set<string>>()
  for (const absence of absences) {
    const schoolId = absence.schoolId
    const usePriority = priorityEnabledBySchool.get(schoolId) && (priorityBySchool.get(schoolId)?.length ?? 0) > 0
    const subIds = usePriority
      ? new Set(priorityBySchool.get(schoolId)!.map(r => r.substituteId))
      : new Set(openPoolBySchool.get(schoolId) ?? [])
    absenceSubPools.set(absence.id, subIds)
  }

  // All unique sub IDs across every school's pool
  const allSubIds = [...new Set([...absenceSubPools.values()].flatMap(s => [...s]))]
  if (allSubIds.length === 0) {
    return { sent: 0, errors: ['No substitutes assigned to this school yet. Go to Substitutes → Manage & Review to add subs.'], positionCount: absences.length }
  }

  // Best priority rank per sub (only meaningful when priority calling is on)
  const bestRank = new Map<string, number>()
  for (const row of priorityRows) {
    const cur = bestRank.get(row.substituteId)
    const rank = row.priorityRank ?? Infinity
    if (cur === undefined || rank < cur) bestRank.set(row.substituteId, rank)
  }

  // Load all eligible subs in the combined pool
  const allSubs = await db.query.substitutes.findMany({
    where: and(eq(schema.substitutes.status, 'active'), inArray(schema.substitutes.id, allSubIds)),
    with: { user: true },
  })

  const eligibleSubs = allSubs
    .filter(s => s.user.organizationId === orgId && s.user.role === 'substitute')
    .sort((a, b) => (bestRank.get(a.id) ?? Infinity) - (bestRank.get(b.id) ?? Infinity))

  // Filter: unavailable on the absence date
  const unavailableRows = eligibleSubs.length > 0
    ? await db
        .select({ substituteId: schema.subUnavailability.substituteId })
        .from(schema.subUnavailability)
        .where(and(
          inArray(schema.subUnavailability.substituteId, eligibleSubs.map(s => s.id)),
          eq(schema.subUnavailability.date, absenceDate)
        ))
    : []
  const unavailableIds = new Set(unavailableRows.map(r => r.substituteId))

  // Filter: already booked for a job on this date
  const bookedRows = eligibleSubs.length > 0
    ? await db
        .select({ substituteId: schema.subAssignments.substituteId })
        .from(schema.subAssignments)
        .where(and(
          inArray(schema.subAssignments.substituteId, eligibleSubs.map(s => s.id)),
          eq(schema.subAssignments.date, absenceDate),
          eq(schema.subAssignments.status, 'assigned')
        ))
    : []
  const bookedIds = new Set(bookedRows.map(r => r.substituteId))

  const skipSubIds = options.skipSubIds ?? new Set<string>()
  const availableSubs = eligibleSubs.filter(s =>
    !unavailableIds.has(s.id) && !bookedIds.has(s.id) && !skipSubIds.has(s.id)
  )

  const sendEmail = org.notifyByEmail !== false
  const sendSmsTxt = org.notifyBySms === true
  const makeCall = org.notifyByPhone === true

  const errors: string[] = []
  let sent = 0

  // Notify all eligible subs in parallel — each sub's notification is independent
  const subResults = await Promise.allSettled(
    availableSubs.map(async (sub): Promise<boolean> => {
      if (!sub.user.email) return false

      // Which positions is this sub eligible for?
      const myAbsences = absences.filter(a => absenceSubPools.get(a.id)?.has(sub.id))
      if (myAbsences.length === 0) return false

      // Generate one token per position for this sub
      const positions = await Promise.all(
        myAbsences.map(async (absence) => {
          const token = await generateNotificationToken(absence.id, sub.id)
          return { absence, token }
        })
      )

      const isSpecificallyRequested = myAbsences.some(a => a.requestedSubId === sub.id)

      if (sendEmail) {
        const { subject, html, text } = buildBundledEmailBody({
          positions: positions.map(({ absence, token }) => {
            const tu = absence.employee?.user
            return {
              schoolName: absence.school.name,
              teacherName: tu ? `${tu.firstName} ${tu.lastName}` : null,
              startDate: absence.startDate,
              endDate: absence.endDate,
              startTime: absence.startTime,
              endTime: absence.endTime,
              notesToSub: absence.notesToSub,
              acceptUrl: `${appUrl}/sub/jobs/${token}?action=accept`,
              declineUrl: `${appUrl}/sub/jobs/${token}?action=decline`,
            }
          }),
          isSpecificallyRequested,
        })
        await sendSubEmail({ to: sub.user.email, subject, html, text })
      }

      if (sendSmsTxt && sub.user.phone) {
        const smsBody = buildBundledSmsBody({
          positions: positions.map(({ absence, token }) => {
            const tu = absence.employee?.user
            return {
              schoolName: absence.school.name,
              teacherName: tu ? `${tu.firstName} ${tu.lastName}` : null,
              startDate: absence.startDate,
              startTime: absence.startTime,
              endTime: absence.endTime,
              acceptUrl: `${appUrl}/sub/jobs/${token}?action=accept`,
              declineUrl: `${appUrl}/sub/jobs/${token}?action=decline`,
            }
          }),
          dashboardUrl: `${appUrl}/sub/dashboard`,
        })
        await sendSms(sub.user.phone, smsBody)
      }

      if (makeCall && sub.user.phone) {
        // IVR route will look up all same-date tokens for this sub
        await makeVoiceCall(sub.user.phone, positions[0].token)
      }

      return true
    })
  )

  for (const result of subResults) {
    if (result.status === 'fulfilled' && result.value) sent++
    else if (result.status === 'rejected') {
      console.error('[BLAST] Failed for sub:', result.reason)
      errors.push(`Failed for sub: ${result.reason}`)
    }
  }

  // Mark all bundled absences as outreach sent
  for (const absence of absences) {
    await db
      .update(schema.teacherTimeOff)
      .set({ subOutreachStatus: 'sent' })
      .where(eq(schema.teacherTimeOff.id, absence.id))
  }

  return { sent, errors, positionCount: absences.length }
}
