'use client'

import { useState, useTransition } from 'react'
import { requestToJoinSchool } from '../../../actions'

export default function JoinSchoolButton({
  schoolId,
  initialStatus,
}: {
  schoolId: string
  initialStatus: string | null
}) {
  const [status, setStatus] = useState(initialStatus)
  const [isPending, startTransition] = useTransition()

  if (status === 'active') {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium">
        ✓ You are approved to work at this school.
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
        Your request to join this school is pending admin approval.
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-500">
        Your request was not approved. Contact the school administrator for more information.
      </div>
    )
  }

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await requestToJoinSchool(schoolId)
          setStatus('pending')
        })
      }
      disabled={isPending}
      className="w-full rounded-lg bg-orange-500 text-white py-3 text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
    >
      {isPending ? 'Sending request...' : 'Request to Join This School'}
    </button>
  )
}
