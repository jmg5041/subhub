/**
 * Approve Absences page — shows all pending absences waiting for approval.
 *
 * When a teacher absence is created, it starts with approval_status = 'unapproved'.
 * A principal comes here to approve or deny each request.
 *
 * Approving an absence means: "Yes, this is confirmed — find a sub if needed."
 * Denying means: "This request is incorrect — don't process it."
 *
 * The approve/deny buttons use HTML forms with Server Actions, so they work
 * without any JavaScript-heavy client logic.
 */

import { ClipboardCheck, AlertCircle, CheckCircle, CalendarDays } from 'lucide-react'
import { getUnapprovedAbsences, approveAbsence, denyAbsence } from '../actions'
import { formatDateRangeShort, countWeekdays } from '@/lib/date-utils'

// Helper: format '07:30:00' → '7:30 AM'
function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default async function ApproveAbsencesPage() {
  const absences = await getUnapprovedAbsences()

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-8 w-8 text-green-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Approve Absences</h1>
            <p className="text-gray-500">Review and approve pending teacher time-off requests</p>
          </div>
        </div>
        {absences.length > 0 && (
          <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
            {absences.length} pending
          </span>
        )}
      </div>

      {/* Empty state */}
      {absences.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-16 text-center">
          <CheckCircle className="h-12 w-12 text-green-400" />
          <p className="mt-4 text-lg font-medium text-gray-900">All caught up!</p>
          <p className="mt-1 text-sm text-gray-500">No absences are waiting for approval right now.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-4 border-b border-gray-200 bg-gray-50 px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
            <span>Teacher</span>
            <span>School</span>
            <span>Date & Time</span>
            <span>Reason</span>
            <span>Actions</span>
          </div>

          {/* Table rows */}
          {absences.map((absence) => (
            <div
              key={absence.id}
              className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-center gap-4 border-b border-gray-100 px-6 py-4 last:border-0 hover:bg-gray-50"
            >
              {/* Teacher name */}
              <div>
                <p className="font-medium text-gray-900">
                  {absence.teacherFirstName} {absence.teacherLastName}
                </p>
                {absence.notesToAdmin && (
                  <p className="mt-0.5 truncate text-xs text-gray-500" title={absence.notesToAdmin}>
                    {absence.notesToAdmin}
                  </p>
                )}
              </div>

              {/* School */}
              <p className="text-sm text-gray-600">{absence.schoolName}</p>

              {/* Date & time */}
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                <span>
                  {formatDateRangeShort(absence.startDate, absence.endDate)} · {formatTime(absence.startTime)} – {formatTime(absence.endTime)}
                </span>
              </div>

              {/* Reason */}
              <span className="text-sm text-gray-600">{absence.reasonName || '—'}</span>

              {/* Approve / Deny buttons — each is a small form that calls a server action */}
              <div className="flex items-center gap-2">
                {/* Approve form */}
                <form action={approveAbsence}>
                  <input type="hidden" name="id" value={absence.id} />
                  <button
                    type="submit"
                    className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-500"
                  >
                    Approve
                  </button>
                </form>

                {/* Deny form */}
                <form action={denyAbsence}>
                  <input type="hidden" name="id" value={absence.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                  >
                    Deny
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Explanation for first-time users */}
      {absences.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
          <p className="text-sm text-blue-700">
            Approving an absence confirms it&apos;s valid and begins the process of finding a substitute
            (if one is required). Denying removes it from the queue without notifying anyone.
          </p>
        </div>
      )}
    </div>
  )
}
