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
import { getAbsenceWithDetails, getAvailableSubs, getUserContext } from '../../actions'
import AbsenceDetailsCard from './AbsenceDetailsCard'
import FindSubClient from './FindSubClient'
import { formatDateRange, countWeekdays } from '@/lib/date-utils'

function formatTime(t: string): string {
  const [hourStr, min] = t.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${min} ${ampm}`
}

export default async function FindSubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [absence, { orgId, userId }] = await Promise.all([
    getAbsenceWithDetails(id),
    getUserContext(),
  ])

  if (!absence) notFound()

  const subs = await getAvailableSubs(absence.schoolId)

  const teacher = absence.employee?.user
  const filledAssignment = absence.assignmentLinks?.[0]?.assignment
  const filledByUser = filledAssignment?.substitute?.user
  const isAlreadyFilled = absence.subOutreachStatus === 'filled'
  const filledByName = filledByUser
    ? `${filledByUser.firstName} ${filledByUser.lastName}`
    : undefined
  const requestedSubName = absence.requestedSub?.user
    ? `${absence.requestedSub.user.firstName} ${absence.requestedSub.user.lastName}`
    : undefined

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Back link */}
      <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">
        ← Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Absence Details</h1>
        <p className="text-sm text-gray-500 mt-1">
          {absence.substituteRequired
            ? 'Choose how to fill this absence.'
            : 'This absence is covered by staff.'}
        </p>
      </div>

      {/* Editable absence details card */}
      <AbsenceDetailsCard
        timeOffId={id}
        teacherName={teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Unknown Teacher'}
        schoolName={absence.school?.name ?? ''}
        date={formatDateRange(absence.startDate, absence.endDate)}
        dayCount={countWeekdays(absence.startDate, absence.endDate)}
        rawStartDate={absence.startDate}
        rawEndDate={absence.endDate}
        timeRange={`${formatTime(absence.startTime)} – ${formatTime(absence.endTime)}`}
        reasonName={absence.reason?.name}
        substituteRequired={absence.substituteRequired ?? true}
        isAlreadyFilled={isAlreadyFilled}
        approvalStatus={absence.approvalStatus ?? 'unapproved'}
        notesToSub={absence.notesToSub ?? null}
        staffCoverageNotes={absence.staffCoverageNotes ?? null}
        requestedSubName={requestedSubName}
        initialAttachments={absence.attachments ?? []}
        orgId={orgId}
        userId={userId}
      />

      {/* Sub assignment panel */}
      <FindSubClient
        timeOffId={id}
        subs={subs}
        isAlreadyFilled={isAlreadyFilled}
        filledByName={filledByName}
        outreachStatus={absence.subOutreachStatus ?? 'not_started'}
        substituteRequired={absence.substituteRequired ?? true}
      />
    </div>
  )
}
