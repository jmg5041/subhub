'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { approveSubForSchool, rejectSubRequest } from './actions'

type PendingRequest = {
  id: string
  substituteId: string
  schoolId: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  avatarUrl: string | null
  schoolName: string
  requestedAt: Date | null
}

type School = { id: string; name: string }

type Props = {
  pending: PendingRequest[]
  orgSchools: School[]
}

export default function HireSubsClient({ pending, orgSchools }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedSchools, setSelectedSchools] = useState<Record<string, string[]>>({})
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const visible = pending.filter(r => !dismissed.has(r.id))

  if (visible.length === 0) return null

  function toggleSchool(requestId: string, schoolId: string) {
    setSelectedSchools(prev => {
      const current = prev[requestId] ?? []
      return {
        ...prev,
        [requestId]: current.includes(schoolId)
          ? current.filter(id => id !== schoolId)
          : [...current, schoolId],
      }
    })
  }

  function handleApprove(request: PendingRequest) {
    const extra = (selectedSchools[request.id] ?? []).filter(id => id !== request.schoolId)
    startTransition(async () => {
      await approveSubForSchool(request.id, extra)
      setDismissed(prev => new Set([...prev, request.id]))
    })
  }

  function handleReject(requestId: string) {
    startTransition(async () => {
      await rejectSubRequest(requestId)
      setDismissed(prev => new Set([...prev, requestId]))
    })
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold h-5 w-5">{visible.length}</span>
        <h2 className="font-semibold text-blue-900">Substitutes Requesting to Join Your School</h2>
      </div>

      <div className="space-y-3">
        {visible.map(req => {
          const isExpanded = expandedId === req.id
          const extra = (selectedSchools[req.id] ?? []).filter(id => id !== req.schoolId)

          return (
            <div key={req.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              {/* Row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {req.avatarUrl ? (
                  <Image src={req.avatarUrl} alt="" width={36} height={36} className="rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                    {req.firstName[0]}{req.lastName[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm">{req.firstName} {req.lastName}</div>
                  <div className="text-xs text-gray-400">Requested to join <strong>{req.schoolName}</strong></div>
                </div>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  Review
                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>

              {/* Expanded review panel */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50">
                  {req.email && <div className="text-sm text-gray-600">{req.email}</div>}
                  {req.phone && <div className="text-sm text-gray-600">{req.phone}</div>}

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Also assign to these schools:
                    </p>
                    <div className="space-y-1.5">
                      {orgSchools.map(school => {
                        const isRequested = school.id === req.schoolId
                        const isChecked = isRequested || (selectedSchools[req.id] ?? []).includes(school.id)
                        return (
                          <label key={school.id} className={`flex items-center gap-2 text-sm cursor-pointer ${isRequested ? 'opacity-60' : ''}`}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isRequested}
                              onChange={() => toggleSchool(req.id, school.id)}
                              className="rounded border-gray-300 text-blue-600"
                            />
                            {school.name}
                            {isRequested && <span className="text-xs text-gray-400">(requested)</span>}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Accept into School
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={isPending}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 text-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Decline
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
