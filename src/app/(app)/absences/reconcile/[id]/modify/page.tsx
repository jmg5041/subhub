import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, UserX, Clock } from 'lucide-react'
import Link from 'next/link'
import { getAbsenceForModify, markSubNoShow, adjustHoursAndReconcile } from '../../../actions'
import { formatDateRangeShort } from '@/lib/date-utils'

// Helper: format '07:30:00' → '7:30 AM'
function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default async function ModifyReconcilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const absence = await getAbsenceForModify(id)

  if (!absence || !absence.assignmentId) notFound()

  async function handleNoShow() {
    'use server'
    await markSubNoShow(id, absence!.assignmentId!)
    redirect('/absences/reconcile')
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/absences/reconcile"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Reconcile
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Modify Assignment</h1>
        <p className="text-gray-500">Adjust hours or mark the sub as a no-show.</p>
      </div>

      {/* Absence summary card */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Teacher</span>
          <span className="font-medium text-gray-900">
            {absence.teacherFirstName} {absence.teacherLastName}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">School</span>
          <span className="text-gray-700">{absence.schoolName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Date</span>
          <span className="text-gray-700">
            {formatDateRangeShort(absence.startDate, absence.endDate)} ·{' '}
            {formatTime(absence.startTime)}–{formatTime(absence.endTime)}
          </span>
        </div>
        <div className="flex justify-between text-sm border-t border-gray-100 pt-3">
          <span className="text-gray-500">Substitute</span>
          <span className="font-medium text-gray-900">
            {absence.subFirstName} {absence.subLastName}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Scheduled hours</span>
          <span className="text-gray-700">
            {absence.totalHours ? `${absence.totalHours} hrs` : 'Not set'}
          </span>
        </div>
      </div>

      {/* Adjust hours form */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-purple-600" />
          <h2 className="font-semibold text-gray-900">Adjust hours &amp; confirm</h2>
        </div>
        <p className="text-sm text-gray-500">
          Update the hours if the sub worked a different amount than scheduled, then confirm.
        </p>
        <form action={adjustHoursAndReconcile}>
          <input type="hidden" name="absenceId" value={absence.id} />
          <input type="hidden" name="assignmentId" value={absence.assignmentId} />
          <div className="flex items-center gap-3">
            <input
              type="number"
              name="hours"
              step="0.25"
              min="0"
              max="24"
              defaultValue={absence.totalHours ?? ''}
              placeholder="e.g. 6.5"
              required
              className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-500">hours</span>
            <button
              type="submit"
              className="ml-auto rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition-colors"
            >
              Save &amp; Confirm
            </button>
          </div>
        </form>
      </div>

      {/* No-show form */}
      <div className="rounded-lg border border-red-100 bg-red-50 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserX className="h-5 w-5 text-red-600" />
          <h2 className="font-semibold text-red-900">Sub didn't show up</h2>
        </div>
        <p className="text-sm text-red-700">
          This will cancel the sub&apos;s assignment so they are not included in payroll,
          and mark the absence as reconciled.
        </p>
        <form action={handleNoShow}>
          <button
            type="submit"
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors"
          >
            Mark as No-Show &amp; Confirm
          </button>
        </form>
      </div>
    </div>
  )
}
