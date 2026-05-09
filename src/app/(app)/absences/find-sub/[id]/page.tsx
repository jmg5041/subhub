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
import { getAbsenceWithDetails, getAvailableSubs, getUserContext, getOtherOpenAbsencesForDate } from '../../actions'
import AbsenceDetailsCard from './AbsenceDetailsCard'
import FindSubClient from './FindSubClient'
import { formatDateRange, countWeekdays } from '@/lib/date-utils'
import { db } from '@/db'
import { organizations, schools } from '@/db/schema'
import { eq } from 'drizzle-orm'

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

  const [subs, org, school] = await Promise.all([
    getAvailableSubs(absence.schoolId),
    db.query.organizations.findFirst({ where: eq(organizations.id, orgId) }),
    absence.schoolId
      ? db.query.schools.findFirst({ where: eq(schools.id, absence.schoolId) })
      : Promise.resolve(null),
  ])

  // Only look for combinable absences on single-day requests
  const isSingleDay = !absence.endDate || absence.endDate === absence.startDate
  const combinableAbsences = isSingleDay
    ? await getOtherOpenAbsencesForDate(
        id,
        absence.startDate,
        absence.schoolId ?? '',
        absence.startTime,
        absence.endTime,
      )
    : []

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
        absenceStartTime={absence.startTime}
        absenceEndTime={absence.endTime}
        schoolDayStart={school?.dayStartTime ?? '07:30:00'}
        schoolDayEnd={school?.dayEndTime ?? '15:30:00'}
        payModel={(org?.subPayModel ?? 'block') as 'block' | 'hourly'}
        halfDayHours={parseFloat(org?.halfDayHours ?? '4.0')}
        fullDayHours={parseFloat(org?.fullDayHours ?? '8.0')}
        combinableAbsences={combinableAbsences}
      />
    </div>
  )
}
