/**
 * Find Sub page — shown after an absence is approved.
 *
 * Displays the absence details (teacher, date, time, school, sub-facing notes)
 * and gives the admin two options:
 *   A) Notify all available subs (email blast, first to accept wins)
 *   B) Assign a specific sub directly (no notification sent)
 *
 * Accessible via the dashboard "Find Sub" link or directly at
 *   /absences/find-sub/[id]
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAbsenceWithDetails, getAvailableSubs } from '../../actions'
import FindSubClient from './FindSubClient'

function formatTime(t: string): string {
  const [hourStr, min] = t.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${min} ${ampm}`
}

function formatDate(d: string): string {
  const date = new Date(d + 'T12:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function FindSubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [absence, subs] = await Promise.all([
    getAbsenceWithDetails(id),
    getAvailableSubs(),
  ])

  if (!absence) notFound()

  const teacher = absence.employee?.user
  const filledAssignment = absence.assignmentLinks?.[0]?.assignment
  const filledByUser = filledAssignment?.substitute?.user
  const isAlreadyFilled = absence.subOutreachStatus === 'filled'
  const filledByName = filledByUser ? `${filledByUser.firstName} ${filledByUser.lastName}` : undefined

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">
          ← Dashboard
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Find a Substitute</h1>
        <p className="text-sm text-gray-500 mt-1">Choose how to fill this absence.</p>
      </div>

      {/* Absence details card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Unknown Teacher'}
            </div>
            <div className="text-sm text-gray-500">{absence.school?.name}</div>
          </div>
          {absence.reason && (
            <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full whitespace-nowrap">
              {absence.reason.name}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Date</div>
            <div className="text-sm font-medium text-gray-800">{formatDate(absence.date)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Time</div>
            <div className="text-sm font-medium text-gray-800">
              {formatTime(absence.startTime)} – {formatTime(absence.endTime)}
            </div>
          </div>
        </div>

        {absence.notesToSub && (
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes for sub</div>
            <p className="text-sm text-gray-700">{absence.notesToSub}</p>
          </div>
        )}

        {absence.requestedSubId && absence.requestedSub?.user && (
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs text-orange-500 uppercase tracking-wide mb-0.5">Specifically requested</div>
            <div className="text-sm font-medium text-gray-800">
              {absence.requestedSub.user.firstName} {absence.requestedSub.user.lastName}
            </div>
          </div>
        )}
      </div>

      {/* Interactive assignment panel */}
      <FindSubClient
        timeOffId={id}
        subs={subs}
        isAlreadyFilled={isAlreadyFilled}
        filledByName={filledByName}
        outreachStatus={absence.subOutreachStatus ?? 'not_started'}
      />
    </div>
  )
}
