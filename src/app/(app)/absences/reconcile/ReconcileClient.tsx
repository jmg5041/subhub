'use client'

import { useState, useTransition } from 'react'
import { Check, CheckCircle, Info } from 'lucide-react'
import { reconcileAbsenceById } from '../actions'
import { formatDateRangeShort } from '@/lib/date-utils'

// Helper: format '07:30:00' → '7:30 AM'
function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

type Absence = {
  id: string
  startDate: string
  endDate: string | null
  startTime: string
  endTime: string
  substituteRequired: boolean | null
  reconciliationStatus: 'unreconciled' | 'reconciled' | null
  notesToAdmin: string | null
  teacherFirstName: string | null
  teacherLastName: string | null
  schoolName: string
  reasonName: string | null
  assignmentId: string | null
  subFirstName: string | null
  subLastName: string | null
  totalHours: string | null
}

function ConfirmButton({ absenceId, onConfirmed }: { absenceId: string; onConfirmed: () => void }) {
  const [confirmed, setConfirmed] = useState(false)
  const [, startTransition] = useTransition()

  if (confirmed) {
    return (
      <span className="flex items-center gap-1 text-sm font-medium text-green-600">
        <Check className="h-4 w-4" /> Confirmed
      </span>
    )
  }

  return (
    <button
      onClick={() => {
        setConfirmed(true)
        startTransition(() => {
          reconcileAbsenceById(absenceId).then(onConfirmed)
        })
      }}
      className="text-sm font-medium text-purple-600 hover:text-purple-800 transition-colors"
    >
      Confirm
    </button>
  )
}

export default function ReconcileClient({ absences }: { absences: Absence[] }) {
  // Track which rows have been confirmed so we can fade them out
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set())

  const visibleAbsences = absences.filter(a => !confirmedIds.has(a.id))

  if (absences.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-16 text-center">
        <CheckCircle className="h-12 w-12 text-purple-400" />
        <p className="mt-4 text-lg font-medium text-gray-900">Nothing to reconcile!</p>
        <p className="mt-1 text-sm text-gray-500">
          All past absences have been reconciled, or there are no past absences yet.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
        <p className="text-sm text-blue-700">
          <strong>Confirm</strong> when the sub showed up and worked as assigned.{' '}
          <strong>Modify</strong> to adjust hours or mark the sub as a no-show — cancelled
          assignments are excluded from payroll automatically.
        </p>
      </div>

      {visibleAbsences.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-16 text-center">
          <CheckCircle className="h-12 w-12 text-green-400" />
          <p className="mt-4 text-lg font-medium text-gray-900">All done!</p>
          <p className="mt-1 text-sm text-gray-500">All absences have been reconciled.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_160px] gap-4 border-b border-gray-200 bg-gray-50 px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
            <span>Teacher</span>
            <span>School · Date</span>
            <span>Substitute</span>
            <span>Hours</span>
            <span>Action</span>
          </div>

          {visibleAbsences.map((absence) => {
            const hasAssignment = !!absence.assignmentId
            const subName = hasAssignment
              ? `${absence.subFirstName} ${absence.subLastName}`
              : absence.substituteRequired
              ? null // sub required but no one assigned
              : 'Not needed'

            return (
              <div
                key={absence.id}
                className="grid grid-cols-[1fr_1fr_1fr_1fr_160px] items-center gap-4 border-b border-gray-100 px-6 py-4 last:border-0 hover:bg-gray-50"
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

                {/* School + Date */}
                <div>
                  <p className="text-sm text-gray-700">{absence.schoolName}</p>
                  <p className="text-xs text-gray-500">
                    {formatDateRangeShort(absence.startDate, absence.endDate)} ·{' '}
                    {formatTime(absence.startTime)}–{formatTime(absence.endTime)}
                  </p>
                </div>

                {/* Sub */}
                <div>
                  {subName ? (
                    <p className="text-sm text-gray-700">{subName}</p>
                  ) : (
                    <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      No sub assigned
                    </span>
                  )}
                </div>

                {/* Hours */}
                <p className="text-sm text-gray-600">
                  {absence.totalHours ? `${absence.totalHours} hrs` : '—'}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <ConfirmButton
                    absenceId={absence.id}
                    onConfirmed={() =>
                      setConfirmedIds(prev => new Set([...prev, absence.id]))
                    }
                  />
                  {hasAssignment && (
                    <>
                      <span className="text-gray-300">|</span>
                      <a
                        href={`/absences/reconcile/${absence.id}/modify`}
                        className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Modify
                      </a>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
