import { NextResponse } from 'next/server'
import { db } from '@/db'
import { subNotificationTokens } from '@/db/schema'
import { eq } from 'drizzle-orm'

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

  const tokenRow = await db.query.subNotificationTokens.findFirst({
    where: eq(subNotificationTokens.token, token),
    with: {
      teacherTimeOff: { with: { school: true } },
    },
  })

  if (!tokenRow || new Date() > tokenRow.expiresAt || tokenRow.usedAt) {
    return twiml('<Say>This request is no longer available. Goodbye.</Say>')
  }

  if (tokenRow.teacherTimeOff.subOutreachStatus === 'filled') {
    return twiml('<Say>This position has already been filled by another substitute. Thank you. Goodbye.</Say>')
  }

  const absence = tokenRow.teacherTimeOff
  const school = absence.school

  return twiml(`
    <Say>Hello! You have a substitute teaching request at ${school.name} on ${formatDate(absence.date)}, from ${formatTime(absence.startTime)} to ${formatTime(absence.endTime)}.</Say>
    <Gather numDigits="1" action="${appUrl}/api/twilio/gather/${token}" method="POST">
      <Say>Press 1 to accept this position. Press 2 to decline.</Say>
    </Gather>
    <Say>We did not receive your input. Please check your email for the accept and decline links. Goodbye.</Say>
  `)
}
