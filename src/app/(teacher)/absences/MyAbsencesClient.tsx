'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { deleteAbsenceRequest } from '../actions'

type Absence = {
  id: string
  date: string
  startTime: string
  endTime: string
  approvalStatus: string | null
  subOutreachStatus: string | null
  substituteRequired: boolean | null
  reason: { name: string } | null
  school: { name: string } | null
  assignmentLinks: {
    assignment: {
      substitute: { user: { firstName: string; lastName: string } } | null
    } | null
  }[]
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function getStatusBadge(absence: Absence) {
  const approval = absence.approvalStatus ?? 'unapproved'
  const outreach = absence.subOutreachStatus ?? 'not_started'

  if (approval === 'denied') return { label: 'Denied', color: 'bg-red-100 text-red-700' }
  if (approval === 'unapproved') return { label: 'Pending approval', color: 'bg-yellow-100 text-yellow-700' }
  if (!absence.substituteRequired) return { label: 'No sub needed', color: 'bg-gray-100 text-gray-600' }
  if (outreach === 'filled') return { label: 'Sub assigned', color: 'bg-green-100 text-green-700' }
  if (outreach === 'sent') return { label: 'Subs notified', color: 'bg-blue-100 text-blue-700' }
  return { label: 'Approved', color: 'bg-green-100 text-green-700' }
}

export default function MyAbsencesClient({ absences }: { absences: Absence[] }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete(id: string, date: string) {
    if (!confirm(`Delete your absence request for ${formatDate(date)}?`)) return
    startTransition(async () => {
      const res = await deleteAbsenceRequest(id)
      if ('error' in res) setError(res.error ?? 'Unknown error')
    })
  }

  if (absences.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-6 py-10 text-center text-gray-500">
        No absence requests yet.{' '}
        <Link href="/teacher/absences/new" className="text-blue-600 hover:underline">Submit your first one.</Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
        {absences.map(a => {
          const { label, color } = getStatusBadge(a)
          const canDelete = a.subOutreachStatus === 'not_started' || a.subOutreachStatus === null
          const filledSub = a.assignmentLinks?.[0]?.assignment?.substitute?.user

          return (
            <div key={a.id} className="flex items-start gap-4 px-6 py-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 text-sm">{formatDate(a.date)}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatTime(a.startTime)} – {formatTime(a.endTime)}
                  {a.school && <> · {a.school.name}</>}
                </div>
                {a.reason && <div className="text-xs text-gray-400 mt-0.5">{a.reason.name}</div>}
                {filledSub && (
                  <div className="text-xs text-green-600 mt-1">
                    Sub: {filledSub.firstName} {filledSub.lastName}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>{label}</span>
                {canDelete && (
                  <button
                    onClick={() => handleDelete(a.id, a.date)}
                    disabled={isPending}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
