/**
 * Reconcile Absences page — confirm that past absences happened as planned.
 *
 * "Reconciling" means going back after the fact and confirming:
 * - Did the absence actually happen?
 * - Did the substitute show up?
 *
 * This is important for payroll: you don't pay a sub until reconciliation confirms
 * they worked. In Phase 5 (Reports), reconciliation will also include rating the sub
 * and entering exact hours. For now, it's a simple confirm action.
 *
 * Only shows PAST approved absences that haven't been reconciled yet.
 */

import { ClipboardList, CheckCircle, Info } from 'lucide-react'
import { getAbsencesForReconcile, reconcileAbsence } from '../actions'

// Helper: format 'YYYY-MM-DD' → 'Mon, May 3'
function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// Helper: format '07:30:00' → '7:30 AM'
function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default async function ReconcileAbsencesPage() {
  const absences = await getAbsencesForReconcile()

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-8 w-8 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reconcile Absences</h1>
            <p className="text-gray-500">Confirm past absences and substitute attendance</p>
          </div>
        </div>
        {absences.length > 0 && (
          <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
            {absences.length} to reconcile
          </span>
        )}
      </div>

      {/* Info banner explaining what reconcile means */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
        <p className="text-sm text-blue-700">
          Reconciling an absence confirms it happened and the substitute worked as assigned.
          This is required before payroll can be processed. Sub ratings and hour adjustments
          will be added in a future update.
        </p>
      </div>

      {/* Empty state */}
      {absences.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-16 text-center">
          <CheckCircle className="h-12 w-12 text-purple-400" />
          <p className="mt-4 text-lg font-medium text-gray-900">Nothing to reconcile!</p>
          <p className="mt-1 text-sm text-gray-500">
            All past absences have been reconciled, or there are no past absences yet.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-4 border-b border-gray-200 bg-gray-50 px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
            <span>Teacher</span>
            <span>School</span>
            <span>Date & Time</span>
            <span>Sub Required</span>
            <span>Action</span>
          </div>

          {/* Absence rows */}
          {absences.map((absence) => (
            <div
              key={absence.id}
              className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-center gap-4 border-b border-gray-100 px-6 py-4 last:border-0 hover:bg-gray-50"
            >
              {/* Teacher */}
              <div>
                <p className="font-medium text-gray-900">
                  {absence.teacherFirstName} {absence.teacherLastName}
                </p>
                {absence.reasonName && (
                  <p className="text-xs text-gray-500">{absence.reasonName}</p>
                )}
              </div>

              {/* School */}
              <p className="text-sm text-gray-600">{absence.schoolName}</p>

              {/* Date & time */}
              <p className="text-sm text-gray-600">
                {formatDate(absence.date)} · {formatTime(absence.startTime)} – {formatTime(absence.endTime)}
              </p>

              {/* Sub required badge */}
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  absence.substituteRequired
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {absence.substituteRequired ? 'Yes' : 'No'}
              </span>

              {/* Confirm (reconcile) button */}
              <form action={reconcileAbsence}>
                <input type="hidden" name="id" value={absence.id} />
                <button
                  type="submit"
                  className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-500"
                >
                  Confirm
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
