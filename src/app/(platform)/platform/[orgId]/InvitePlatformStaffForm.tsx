'use client'

import { useActionState } from 'react'
import { invitePlatformStaff } from '../actions'

export function InvitePlatformStaffForm({ orgId }: { orgId: string }) {
  const [state, action, pending] = useActionState(invitePlatformStaff, undefined)

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-5">
      <p className="text-sm font-semibold text-white mb-4">Invite IT Staff</p>
      <form action={action} className="space-y-3">
        <input type="hidden" name="orgId" value={orgId} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">First name</label>
            <input type="text" name="firstName" required placeholder="Jane"
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Last name</label>
            <input type="text" name="lastName" required placeholder="Smith"
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Email</label>
          <input type="email" name="email" required placeholder="jane@example.com"
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
        </div>
        {state?.error && (
          <p className="rounded-md bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          {pending ? 'Sending…' : 'Send invite'}
        </button>
      </form>
    </div>
  )
}
