'use client'

import { useState, useTransition } from 'react'
import { platformResetPassword, platformClearStuckAuth } from '../actions'

export type OrgUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  status: string | null
  lastSignIn: string | null
  emailConfirmed: boolean
}

export type PendingInvite = {
  id: string
  email: string
  role: string
  expiresAt: string
  isStuck: boolean
}

const ROLE_COLORS: Record<string, string> = {
  admin:       'bg-purple-900 text-purple-300',
  principal:   'bg-blue-900 text-blue-300',
  staff:       'bg-gray-700 text-gray-300',
  teacher:     'bg-green-900 text-green-300',
  substitute:  'bg-yellow-900 text-yellow-300',
}

export function PlatformUsersSection({
  users,
  invites,
}: {
  users: OrgUser[]
  invites: PendingInvite[]
}) {
  const [resetTargetId, setResetTargetId] = useState<string | null>(null)
  const [newPassword, setNewPassword]     = useState('')
  const [message, setMessage]             = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [isPending, startTransition]      = useTransition()

  function handleReset(userId: string) {
    if (!newPassword || newPassword.length < 8) {
      setMessage({ text: 'Password must be at least 8 characters', type: 'error' })
      return
    }
    startTransition(async () => {
      const fd = new FormData()
      fd.set('userId', userId)
      fd.set('password', newPassword)
      const res = await platformResetPassword(fd)
      if ('error' in res) {
        setMessage({ text: res.error, type: 'error' })
      } else {
        setMessage({ text: 'Password reset successfully', type: 'success' })
        setResetTargetId(null)
        setNewPassword('')
      }
    })
  }

  function handleClearStuck(email: string) {
    if (!confirm(`Clear stuck auth account for ${email}?\n\nThis deletes the dangling account so the email can be re-invited.`)) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set('email', email)
      const res = await platformClearStuckAuth(fd)
      if ('error' in res) {
        setMessage({ text: res.error, type: 'error' })
      } else {
        setMessage({ text: `Auth account cleared for ${email}. You can now re-invite them.`, type: 'success' })
      }
    })
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`rounded-md px-4 py-2 text-sm ${
          message.type === 'success' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Active users */}
      <div className="rounded-lg border border-gray-700 overflow-hidden">
        <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
            Users ({users.length})
          </p>
          <p className="text-xs text-gray-600">IT can reset any user&apos;s password from here</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Last login</th>
              <th className="px-4 py-2 text-left">Auth</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {users.map(u => (
              <tr key={u.id} className="bg-gray-900 hover:bg-gray-850">
                <td className="px-4 py-3 text-gray-200 font-medium">
                  {u.firstName} {u.lastName}
                  {u.status === 'inactive' && (
                    <span className="ml-2 text-xs text-red-400">(inactive)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-700 text-gray-300'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${u.emailConfirmed ? 'text-green-400' : 'text-yellow-400'}`}>
                    {u.emailConfirmed ? '✓ Confirmed' : '⚠ Unconfirmed'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {resetTargetId === u.id ? (
                    <div className="flex items-center gap-2 justify-end">
                      <input
                        type="password"
                        placeholder="Min 8 chars"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleReset(u.id)}
                        className="text-xs border border-gray-600 rounded bg-gray-800 text-white px-2 py-1 w-28 focus:outline-none focus:border-indigo-500"
                      />
                      <button onClick={() => handleReset(u.id)} disabled={isPending}
                        className="text-xs text-indigo-400 hover:text-indigo-200">
                        Set
                      </button>
                      <button onClick={() => { setResetTargetId(null); setNewPassword('') }}
                        className="text-xs text-gray-500 hover:text-gray-300">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setResetTargetId(u.id); setNewPassword(''); setMessage(null) }}
                      className="text-xs text-indigo-400 hover:text-indigo-200"
                    >
                      Reset password
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending invitations */}
      {invites.length > 0 && (
        <div className="rounded-lg border border-gray-700 overflow-hidden">
          <div className="bg-gray-800 px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
              Pending Invitations ({invites.length})
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Role</th>
                <th className="px-4 py-2 text-left">Expires</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {invites.map(inv => (
                <tr key={inv.id} className="bg-gray-900">
                  <td className="px-4 py-3 text-gray-400 text-xs">{inv.email}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs capitalize">{inv.role}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {inv.isStuck ? (
                      <span className="text-xs text-red-400">⚠ Stuck — link clicked but login failed</span>
                    ) : (
                      <span className="text-xs text-gray-500">Awaiting email confirmation</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {inv.isStuck && (
                      <button
                        onClick={() => handleClearStuck(inv.email)}
                        disabled={isPending}
                        className="text-xs text-red-400 hover:text-red-200"
                      >
                        Clear &amp; allow re-invite
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
