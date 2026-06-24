/**
 * Confirmation page — shown after a sub accepts a job.
 */

import { db } from '@/db'
import { subNotificationTokens, organizations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { formatDateRange } from '@/lib/date-utils'

function formatTime(t: string): string {
  const [hourStr, min] = t.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${min} ${ampm}`
}

function makeIcsContent(summary: string, date: string, start: string, end: string, location: string, tz: string): string {
  const datePart = date.replace(/-/g, '')
  const startTime = start.replace(/:/g, '').slice(0, 4) + '00'
  const endTime = end.replace(/:/g, '').slice(0, 4) + '00'
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SubHub//SubHub//EN',
    'BEGIN:VEVENT',
    `DTSTART;TZID=${tz}:${datePart}T${startTime}`,
    `DTEND;TZID=${tz}:${datePart}T${endTime}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export default async function ConfirmedPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ already_filled?: string }>
}) {
  const { token } = await params
  const { already_filled } = await searchParams

  if (already_filled) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">⚡</div>
          <div className="text-xl font-semibold text-gray-900 mb-2">Position No Longer Available</div>
          <p className="text-sm text-gray-500">This position has already been filled or this link is no longer active. No action is needed from you.</p>
        </div>
      </div>
    )
  }

  const tokenRow = await db.query.subNotificationTokens.findFirst({
    where: eq(subNotificationTokens.token, token),
    with: {
      teacherTimeOff: {
        with: { school: true },
      },
      substitute: {
        with: { user: true },
      },
    },
  })

  if (!tokenRow || tokenRow.action !== 'accepted') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500">This confirmation page is no longer available.</p>
        </div>
      </div>
    )
  }

  const absence = tokenRow.teacherTimeOff
  const sub = tokenRow.substitute.user
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, absence.organizationId) })
  const icsContent = makeIcsContent(
    `Substitute at ${absence.school.name}`,
    absence.startDate,
    absence.startTime,
    absence.endTime,
    absence.school.address ?? absence.school.name,
    org?.timezone ?? 'America/Los_Angeles',
  )
  const icsDataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <div className="text-2xl font-bold text-gray-900">You&apos;re Confirmed!</div>
          <p className="text-sm text-gray-500 mt-1">Thanks, {sub.firstName}. See you there.</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">School</div>
            <div className="font-semibold text-gray-900">{absence.school.name}</div>
            {absence.school.address && (
              <div className="text-sm text-gray-500 mt-0.5">{absence.school.address}, {absence.school.city}</div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Date</div>
              <div className="text-sm font-medium text-gray-800">{formatDateRange(absence.startDate, absence.endDate)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Time</div>
              <div className="text-sm font-medium text-gray-800">
                {formatTime(absence.startTime)} – {formatTime(absence.endTime)}
              </div>
            </div>
          </div>
          {absence.notesToSub && (
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Notes</div>
              <p className="text-sm text-gray-700">{absence.notesToSub}</p>
            </div>
          )}
        </div>

        <a
          href="/sub/dashboard"
          className="block w-full text-center bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Go to My Dashboard
        </a>

        <a
          href={icsDataUrl}
          download={`subhub-${absence.startDate}.ics`}
          className="block w-full text-center border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Add to Calendar
        </a>

        <p className="text-xs text-center text-gray-400">
          Questions? Contact your school administrator.
        </p>
      </div>
    </div>
  )
}
