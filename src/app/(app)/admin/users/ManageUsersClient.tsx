'use client'

import { useState, useTransition } from 'react'
import { inviteUser, resendInvite, updateUserRole, setTempPassword, deactivateUser, reactivateUser } from '../actions'

type User = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  status: string | null
  schoolId: string | null
}

type Invite = {
  id: string
  email: string
  role: string
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date | null
}

type School = { id: string; name: string }

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  principal: 'Principal',
  staff: 'Staff',
  teacher: 'Teacher',
  substitute: 'Substitute',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  principal: 'bg-purple-100 text-purple-700',
  staff: 'bg-blue-100 text-blue-700',
  teacher: 'bg-green-100 text-green-700',
  substitute: 'bg-orange-100 text-orange-700',
}

export default function ManageUsersClient({
  users,
  invites,
  schools,
}: {
  users: User[]
  invites: Invite[]
  schools: School[]
}) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [tempPasswordUserId, setTempPasswordUserId] = useState<string | null>(null)
  const [tempPassValue, setTempPassValue] = useState('')
  const [pendingInviteLink, setPendingInviteLink] = useState<string | null>(null)

  function showMessage(text: string, type: 'success' | 'error') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await inviteUser(formData)
      if ('error' in res) showMessage(res.error ?? 'Unknown error', 'error')
      else showMessage('Invite sent! The user will receive an email to set their password.', 'success')
    })
  }

  function handleResend(email: string, role: string) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('email', email)
      fd.set('role', role)
      const res = await resendInvite(fd)
      if ('error' in res) {
        showMessage(res.error ?? 'Unknown error', 'error')
      } else if ('inviteLink' in res && res.inviteLink) {
        setPendingInviteLink(res.inviteLink as string)
      } else {
        showMessage(`Invite resent to ${email}`, 'success')
      }
    })
  }

  function handleRoleChange(userId: string, role: string) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('userId', userId)
      fd.set('role', role)
      await updateUserRole(fd)
      showMessage('Role updated.', 'success')
    })
  }

  function handleSetTempPassword(userId: string) {
    if (!tempPassValue || tempPassValue.length < 8) {
      showMessage('Password must be at least 8 characters.', 'error')
      return
    }
    startTransition(async () => {
      const fd = new FormData()
      fd.set('userId', userId)
      fd.set('password', tempPassValue)
      const res = await setTempPassword(fd)
      if ('error' in res) showMessage(res.error ?? 'Unknown error', 'error')
      else {
        showMessage('Temporary password set. Share it with the user securely.', 'success')
        setTempPasswordUserId(null)
        setTempPassValue('')
      }
    })
  }

  function handleDeactivate(userId: string, name: string) {
    if (!confirm(`Deactivate ${name}? They will no longer be able to log in.`)) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set('userId', userId)
      await deactivateUser(fd)
      showMessage(`${name} has been deactivated.`, 'success')
    })
  }

  function handleReactivate(userId: string, name: string) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('userId', userId)
      const res = await reactivateUser(fd)
      if ('error' in res) showMessage(res.error ?? 'Unknown error', 'error')
      else showMessage(`${name} has been reactivated.`, 'success')
    })
  }

  const pendingInvites = invites.filter(i => !i.usedAt && new Date() < new Date(i.expiresAt))
  const expiredInvites = invites.filter(i => !i.usedAt && new Date() >= new Date(i.expiresAt))

  return (
    <div className="space-y-8">
      {message && (
        <div className={`rounded-lg border p-4 text-sm ${message.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Invite link to share (when no email service is configured) */}
      {pendingInviteLink && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
          <p className="text-sm font-medium text-blue-900">Share this invite link directly with the user:</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={pendingInviteLink}
              className="flex-1 text-xs font-mono border border-blue-200 rounded px-2 py-1.5 bg-white text-gray-700"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(pendingInviteLink)
                showMessage('Link copied to clipboard!', 'success')
                setPendingInviteLink(null)
              }}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
            >
              Copy
            </button>
            <button onClick={() => setPendingInviteLink(null)} className="text-xs text-gray-400 hover:text-gray-600">
              Dismiss
            </button>
          </div>
          <p className="text-xs text-blue-600">This link expires in 24 hours.</p>
        </div>
      )}

      {/* ── Invite New User ── */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Invite New User</h2>
        <form onSubmit={handleInvite} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input name="firstName" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input name="lastName" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input name="email" type="email" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select name="role" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="teacher">Teacher</option>
              <option value="substitute">Substitute</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
            <select name="schoolId" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— No specific school —</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>

      {/* ── All Users ── */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">All Users ({users.length})</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-4 px-6 py-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 text-sm">{u.firstName} {u.lastName}</div>
                <div className="text-xs text-gray-400 truncate">{u.email}</div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                {ROLE_LABELS[u.role] ?? u.role}
              </span>
              {u.status === 'inactive' && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactive</span>
              )}
              {/* Role change */}
              <select
                defaultValue={u.role}
                onChange={e => handleRoleChange(u.id, e.target.value)}
                disabled={isPending}
                className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="teacher">Teacher</option>
                <option value="substitute">Substitute</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
                <option value="principal">Principal</option>
              </select>
              {/* Temp password */}
              {tempPasswordUserId === u.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    placeholder="New temp password"
                    value={tempPassValue}
                    onChange={e => setTempPassValue(e.target.value)}
                    className="text-xs border border-gray-300 rounded px-2 py-1 w-36 focus:outline-none"
                  />
                  <button onClick={() => handleSetTempPassword(u.id)} disabled={isPending} className="text-xs text-blue-600 hover:underline">Set</button>
                  <button onClick={() => setTempPasswordUserId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setTempPasswordUserId(u.id)} className="text-xs text-gray-400 hover:text-gray-700">
                  Set password
                </button>
              )}
              {/* Deactivate / Reactivate */}
              {u.status === 'inactive' ? (
                <button
                  onClick={() => handleReactivate(u.id, `${u.firstName} ${u.lastName}`)}
                  disabled={isPending}
                  className="text-xs text-green-600 hover:text-green-800"
                >
                  Reactivate
                </button>
              ) : (
                <button
                  onClick={() => handleDeactivate(u.id, `${u.firstName} ${u.lastName}`)}
                  disabled={isPending}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Deactivate
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Pending Invites ── */}
      {pendingInvites.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Pending Invites ({pendingInvites.length})</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingInvites.map(inv => (
              <div key={inv.id} className="flex items-center gap-4 px-6 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900">{inv.email}</div>
                  <div className="text-xs text-gray-400">
                    {ROLE_LABELS[inv.role]} · Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Pending</span>
                <button
                  onClick={() => handleResend(inv.email, inv.role)}
                  disabled={isPending}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Resend
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Expired Invites ── */}
      {expiredInvites.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Expired Invites ({expiredInvites.length})</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {expiredInvites.map(inv => (
              <div key={inv.id} className="flex items-center gap-4 px-6 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900">{inv.email}</div>
                  <div className="text-xs text-gray-400">{ROLE_LABELS[inv.role]}</div>
                </div>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Expired</span>
                <button
                  onClick={() => handleResend(inv.email, inv.role)}
                  disabled={isPending}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Resend
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
