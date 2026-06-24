/**
 * Twilio Voice IVR — called by Twilio when a substitute answers the phone.
 *
 * HOW IT WORKS
 * Twilio makes a POST to this route when a sub picks up. We respond with TwiML
 * (XML instructions) that tell Twilio what to say and what to listen for.
 *
 * The [token] in the URL is the "primary token" — it identifies which sub is
 * being called and what date we're calling about. We then look up ALL active
 * same-date tokens for that sub to build the full position list.
 *
 * SINGLE POSITION: "You have a request for [teacher] at [school] on [date]...
 *   Press 1 to accept. Press 2 to decline."
 *
 * MULTIPLE POSITIONS: "You have [N] positions on [date].
 *   Press 1 for [school], [teacher]'s class, [time].
 *   Press 2 for [school2]...
 *   Press 0 to hear these options again."
 *
 * IMPORTANT: Positions are sorted by school name A→Z. The gather route
 * (gather/[token]/route.ts) uses the SAME sort order to map digits to positions.
 * If you change the sort here, change it there too — otherwise pressing "2"
 * would accept the wrong position.
 *
 * After the <Say> block, <Gather> listens for a keypress. If no key is pressed,
 * we fall through to a "we didn't receive your input" message.
 */

import { NextResponse } from 'next/server'
import { db } from '@/db'
import { subNotificationTokens } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

function formatTime(t: string): string {
  const [hourStr, min] = t.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'P. M.' : 'A. M.'
  const h12 = hour % 12 || 12
  return `${h12}:${min} ${ampm}`
}

function formatDate(d: string): string {
  const date = new Date(d + 'T12:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function twiml(body: string): NextResponse {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Load the primary token to identify sub and date
  const primary = await db.query.subNotificationTokens.findFirst({
    where: eq(subNotificationTokens.token, token),
    with: { teacherTimeOff: { with: { school: true, employee: { with: { user: true } } } } },
  })

  if (!primary || new Date() > primary.expiresAt || primary.usedAt) {
    return twiml('<Say>This request is no longer available. Goodbye.</Say>')
  }

  const substituteId = primary.substituteId
  const absenceDate = primary.teacherTimeOff.startDate

  // Find all active same-date tokens for this sub (capped at 9)
  const allTokens = await db.query.subNotificationTokens.findMany({
    where: and(
      eq(subNotificationTokens.substituteId, substituteId),
      isNull(subNotificationTokens.usedAt),
    ),
    with: { teacherTimeOff: { with: { school: true, employee: { with: { user: true } } } } },
  })

  const seenAbsenceIds = new Set<string>()
  const positions = allTokens
    .filter(t =>
      t.teacherTimeOff.startDate === absenceDate &&
      new Date() < t.expiresAt &&
      t.teacherTimeOff.subOutreachStatus !== 'filled'
    )
    .sort((a, b) => a.teacherTimeOff.school.name.localeCompare(b.teacherTimeOff.school.name))
    .filter(t => {
      if (seenAbsenceIds.has(t.teacherTimeOffId)) return false
      seenAbsenceIds.add(t.teacherTimeOffId)
      return true
    })
    .slice(0, 9)

  if (positions.length === 0) {
    return twiml('<Say>All positions for this date have been filled. Thank you. Goodbye.</Say>')
  }

  // Build the position list speech
  let positionSpeech = ''
  if (positions.length === 1) {
    const p = positions[0]
    const u = p.teacherTimeOff.employee?.user
    const forTeacher = u ? `for ${u.firstName} ${u.lastName} ` : ''
    positionSpeech = `You have a substitute teaching request ${forTeacher}at ${p.teacherTimeOff.school.name} on ${formatDate(p.teacherTimeOff.startDate)}, from ${formatTime(p.teacherTimeOff.startTime)} to ${formatTime(p.teacherTimeOff.endTime)}.`
  } else {
    const lines = positions.map((p, i) => {
      const u = p.teacherTimeOff.employee?.user
      const teacherPart = u ? `, ${u.firstName} ${u.lastName}'s class` : ''
      return `Press ${i + 1} for ${p.teacherTimeOff.school.name}${teacherPart}, ${formatTime(p.teacherTimeOff.startTime)} to ${formatTime(p.teacherTimeOff.endTime)}.`
    }).join(' ')
    positionSpeech = `You have ${positions.length} substitute teaching positions available on ${formatDate(absenceDate)}. ${lines}`
  }

  const acceptPrompt = positions.length === 1
    ? 'Press 1 to accept this position. Press 2 to decline.'
    : `Press the number of the position you want to accept. Press 0 to hear these options again.`

  return twiml(`
    <Say>${positionSpeech}</Say>
    <Gather numDigits="1" action="${appUrl}/api/twilio/gather/${token}" method="POST">
      <Say>${acceptPrompt}</Say>
    </Gather>
    <Say>We did not receive your input. Please check your email for the accept and decline links. Goodbye.</Say>
  `)
}
