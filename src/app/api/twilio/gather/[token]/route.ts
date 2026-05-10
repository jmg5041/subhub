/**
 * Twilio Gather webhook — called when a substitute presses a digit during the IVR call.
 *
 * HOW IT WORKS
 * After the voice route speaks the position list, Twilio's <Gather> element waits for
 * a keypress. When the sub presses a digit, Twilio POSTs the digit to this route.
 *
 * We re-run the same position query as the voice route (same sort: school name A→Z)
 * to map the digit back to the correct position. It's critical this sort matches.
 *
 * DIGIT HANDLING
 *   0 → Redirect back to the voice route to repeat the options
 *
 *   Single position mode (only 1 active position for this sub/date):
 *     1 → Accept the position
 *     2 → Decline the position
 *
 *   Multi-position mode (2+ active positions):
 *     1–9 → Accept the position at that index (digit − 1)
 *     (No phone decline in multi-position mode. Sub can decline via email links.)
 *
 * After acceptance, performAcceptJob handles:
 *   - Creating the sub_assignment record
 *   - Marking the absence as filled
 *   - Auto-declining all other same-date tokens for this sub
 *   - Sending a confirmation email
 */

import { NextRequest, NextResponse } from 'next/server'
import { performAcceptJob, performDeclineJob } from '@/lib/sub-job-logic'
import { db } from '@/db'
import { subNotificationTokens } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

function twiml(body: string): NextResponse {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const body = await req.formData()
  const digits = body.get('Digits') as string

  // Load primary token to get sub + date context
  const primary = await db.query.subNotificationTokens.findFirst({
    where: eq(subNotificationTokens.token, token),
    with: { teacherTimeOff: { with: { school: true } } },
  })

  if (!primary || new Date() > primary.expiresAt || primary.usedAt) {
    return twiml('This request is no longer available. Goodbye.')
  }

  const substituteId = primary.substituteId
  const absenceDate = primary.teacherTimeOff.startDate

  // Load all active same-date tokens for this sub — same logic as the voice route
  const allTokens = await db.query.subNotificationTokens.findMany({
    where: and(
      eq(subNotificationTokens.substituteId, substituteId),
      isNull(subNotificationTokens.usedAt),
    ),
    with: { teacherTimeOff: { with: { school: true } } },
  })

  const positions = allTokens
    .filter(t =>
      t.teacherTimeOff.startDate === absenceDate &&
      new Date() < t.expiresAt &&
      t.teacherTimeOff.subOutreachStatus !== 'filled'
    )
    .sort((a, b) => a.teacherTimeOff.school.name.localeCompare(b.teacherTimeOff.school.name))
    .slice(0, 9)

  // Press 0: redirect back to voice route to repeat the options
  if (digits === '0') {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">${appUrl}/api/twilio/voice/${token}</Redirect></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }

  if (positions.length === 0) {
    return twiml('All positions for this date have been filled. Thank you. Goodbye.')
  }

  // Single-position mode: 1 = accept, 2 = decline
  if (positions.length === 1) {
    if (digits === '1') {
      const result = await performAcceptJob(positions[0].token)
      if ('success' in result) {
        return twiml('Thank you! You are confirmed for this substitute position. You should receive a confirmation email shortly. Goodbye!')
      }
      if (result.alreadyFilled) {
        return twiml('Sorry, this position has already been filled by another substitute. Thank you for your interest. Goodbye.')
      }
      return twiml('We were unable to process your acceptance. Please check your email for the accept link. Goodbye.')
    }
    if (digits === '2') {
      await performDeclineJob(positions[0].token)
      return twiml('Thank you. We will reach out to other substitutes. Goodbye.')
    }
    return twiml('We did not understand your selection. Please check your email for the accept and decline links. Goodbye.')
  }

  // Multi-position mode: press the number of the position to accept
  const idx = parseInt(digits, 10) - 1
  if (!isNaN(idx) && idx >= 0 && idx < positions.length) {
    const result = await performAcceptJob(positions[idx].token)
    if ('success' in result) {
      const forTeacher = result.teacherName ? ` for ${result.teacherName}` : ''
      return twiml(`Thank you! You are confirmed for the position${forTeacher} at ${result.schoolName}. You should receive a confirmation email shortly. Goodbye!`)
    }
    if (result.alreadyFilled) {
      return twiml('Sorry, this position has already been filled by another substitute. Thank you for your interest. Goodbye.')
    }
    return twiml('We were unable to process your acceptance. Please check your email for the accept link. Goodbye.')
  }

  return twiml('We did not understand your selection. Please check your email for the accept and decline links. Goodbye.')
}
