/**
 * Sub accept/decline page — public, no login required.
 *
 * Subs receive a unique link via email. This page shows the job details
 * and two buttons: Accept or Decline.
 *
 * The URL token authenticates the sub — it's unique per sub per absence.
 * First sub to accept gets the position.
 */

import { db } from '@/db'
import { subNotificationTokens } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { acceptSubJob, declineSubJob } from './actions'
import { formatDateRange, countWeekdays } from '@/lib/date-utils'

function formatTime(t: string): string {
  const [hourStr, min] = t.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${min} ${ampm}`
}

export default async function SubJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ action?: string }>
}) {
  const { token } = await params
  const { action } = await searchParams

  const tokenRow = await db.query.subNotificationTokens.findFirst({
    where: eq(subNotificationTokens.token, token),
    with: {
      teacherTimeOff: {
        with: { school: true, employee: { with: { user: true } } },
      },
      substitute: {
        with: { user: true },
      },
    },
  })

  // Token not found
  if (!tokenRow) {
    return <StatusPage title="Link Not Found" message="This link is invalid or has expired. Please contact your administrator." />
  }

  // Expired
  if (new Date() > tokenRow.expiresAt) {
    return <StatusPage title="Link Expired" message="This link has expired (links are valid for 48 hours). Please contact your administrator if you still need to respond." />
  }

  // Already responded
  if (tokenRow.action) {
    const responded = tokenRow.action === 'accepted' ? 'accepted' : 'declined'
    return <StatusPage title={`You already ${responded} this request`} message="No further action is needed." />
  }

  // Position already filled by someone else
  if (tokenRow.teacherTimeOff.subOutreachStatus === 'filled') {
    return <StatusPage title="Position Already Filled" message="Another substitute has already accepted this position. Thank you for your interest." />
  }

  const absence = tokenRow.teacherTimeOff
  const sub = tokenRow.substitute.user
  const isSpecificallyRequested = absence.requestedSubId === tokenRow.substituteId

  // Handle direct action links (?action=accept or ?action=decline) for email buttons
  if (action === 'accept') {
    await acceptSubJob(token) // redirects to /confirmed
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">Substitute Request</div>
          <p className="text-sm text-gray-500 mt-1">Hi {sub.firstName}, you&apos;ve been invited to substitute.</p>
        </div>

        {isSpecificallyRequested && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 text-center font-medium">
            You have been specifically requested for this position.
          </div>
        )}

        {/* Job details */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">School</div>
            <div className="font-semibold text-gray-900">{absence.school.name}</div>
            {absence.school.address && (
              <div className="text-sm text-gray-500 mt-0.5">{absence.school.address}, {absence.school.city}</div>
            )}
          </div>
          {absence.employee?.user && (
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Covering for</div>
              <div className="text-sm font-medium text-gray-800">
                {absence.employee.user.firstName} {absence.employee.user.lastName}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
                {countWeekdays(absence.startDate, absence.endDate) > 1
                  ? `Date Range (${countWeekdays(absence.startDate, absence.endDate)} days)`
                  : 'Date'}
              </div>
              <div className="text-sm font-medium text-gray-800">
                {formatDateRange(absence.startDate, absence.endDate)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Daily Hours</div>
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

        <p className="text-xs text-center text-gray-400">
          First substitute to accept gets the position. These links are unique to you.
        </p>

        {/* Accept / Decline forms */}
        <div className="flex gap-3">
          <form action={acceptSubJob.bind(null, token)} className="flex-1">
            <button
              type="submit"
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors"
            >
              Accept
            </button>
          </form>
          <form action={declineSubJob.bind(null, token)} className="flex-1">
            <button
              type="submit"
              className="w-full bg-red-100 text-red-700 py-3 rounded-lg font-semibold text-lg hover:bg-red-200 transition-colors"
            >
              Decline
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function StatusPage({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-xl font-semibold text-gray-900 mb-2">{title}</div>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  )
}
