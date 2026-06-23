'use client'

import { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { inviteUser, resendInvite, cancelInvite, updateUserRole, updateUser, deleteUser, setTempPassword, deactivateUser, reactivateUser, saveUserAvatar, bulkInviteUsers } from '../actions'
import { Camera, X } from 'lucide-react'
import { resizeImage } from '@/lib/resize-image'

type User = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  role: string
  status: string | null
  schoolId: string | null
  schoolIds: string[]
  avatarUrl: string | null
  emailBounced: boolean
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
  principal: 'School Admin',
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
  const [inviteRole, setInviteRole] = useState('teacher')
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [bulkRole, setBulkRole] = useState('teacher')
  const [bulkSchoolId, setBulkSchoolId] = useState('')
  const [bulkRows, setBulkRows] = useState<Array<{
    firstName: string; lastName: string; email: string; phone?: string
    csvRole?: string; csvSchool?: string // raw values from CSV columns if present
  }>>([])
  const [bulkParseError, setBulkParseError] = useState<string | null>(null)
  const [bulkResults, setBulkResults] = useState<{ sent: number; errors: string[] } | null>(null)
  const [bulkSendInvites, setBulkSendInvites] = useState(true)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', phone: '', role: '', schoolIds: [] as string[] })
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  function showMessage(text: string, type: 'success' | 'error') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  function openEditModal(u: User) {
    setEditingUser(u)
    setEditAvatarUrl(u.avatarUrl)
    setEditForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone ?? '',
      role: u.role,
      schoolIds: u.schoolIds.length > 0 ? u.schoolIds : (u.schoolId ? [u.schoolId] : []),
    })
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !editingUser) return
    setUploadingAvatar(true)
    try {
      const resized = await resizeImage(file)
      const fd = new FormData()
      fd.append('file', resized, 'avatar.jpg')
      fd.append('targetUserId', editingUser.id)
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Upload failed')
      const { url } = await res.json()
      await saveUserAvatar(editingUser.id, url)
      setEditAvatarUrl(url)
      showMessage('Photo updated.', 'success')
    } catch {
      showMessage('Photo upload failed.', 'error')
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  function handleSaveEdit() {
    if (!editingUser) return

    const isAdminRole = (r: string) => r === 'admin' || r === 'principal'
    const demotingAdmin = isAdminRole(editingUser.role) && !isAdminRole(editForm.role)

    // Warn when demoting an admin — this makes them deletable
    if (demotingAdmin) {
      if (!confirm(
        `Changing ${editingUser.firstName} ${editingUser.lastName}'s role from ${editingUser.role} to ${editForm.role} will make this account deletable.\n\nDo you want to proceed?`
      )) return
    }

    startTransition(async () => {
      // Handle role change first — it has the guard that blocks teacher→sub
      if (editForm.role !== editingUser.role) {
        const rfd = new FormData()
        rfd.set('userId', editingUser.id)
        rfd.set('role', editForm.role)
        const rRes = await updateUserRole(rfd)
        if ('error' in rRes) {
          showMessage(rRes.error ?? 'Role change failed.', 'error')
          return
        }
      }
      const fd = new FormData()
      fd.set('userId', editingUser.id)
      fd.set('firstName', editForm.firstName)
      fd.set('lastName', editForm.lastName)
      fd.set('email', editForm.email)
      fd.set('phone', editForm.phone)
      fd.set('schoolIds', JSON.stringify(editForm.schoolIds))
      const res = await updateUser(fd)
      if ('error' in res) showMessage(res.error ?? 'Unknown error', 'error')
      else {
        showMessage('User updated.', 'success')
        setEditingUser(null)
      }
    })
  }

  function handleDelete(u: User) {
    if (!confirm(`Permanently delete ${u.firstName} ${u.lastName}?\n\nThis removes their login access and all their data. This cannot be undone.`)) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set('userId', u.id)
      const res = await deleteUser(fd)
      if ('error' in res) showMessage(res.error ?? 'Failed to delete user', 'error')
      else {
        showMessage(`${u.firstName} ${u.lastName} has been deleted.`, 'success')
        setEditingUser(null)
      }
    })
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

  function handleBulkFile(e: React.ChangeEvent<HTMLInputElement>) {
    setBulkResults(null)
    setBulkParseError(null)
    setBulkRows([])
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const result = parseCsv(text)
      if (typeof result === 'string') {
        // Check if it's a warnings+rows bundle
        try {
          const parsed = JSON.parse(result) as { rows: typeof bulkRows; warnings: string[] }
          if (parsed.rows && parsed.warnings) {
            setBulkRows(parsed.rows)
            setBulkParseError(parsed.warnings.join('\n'))
            return
          }
        } catch { /* not JSON — regular error string */ }
        setBulkParseError(result)
      } else {
        setBulkRows(result)
      }
    }
    reader.readAsText(file)
  }

  function handleBulkSubmit() {
    if (bulkRows.length === 0) return

    // Resolve each row to its final role + schoolId
    const resolved: Array<{ firstName: string; lastName: string; email: string; phone?: string; role: string; schoolId?: string }> = []
    const resolveErrors: string[] = []

    const validRoles = ['admin', 'principal', 'staff', 'teacher', 'substitute', 'district']

    for (const row of bulkRows) {
      const role = row.csvRole?.toLowerCase().trim() || bulkRole

      // Reject unrecognised roles cleanly before hitting the DB
      if (!validRoles.includes(role)) {
        resolveErrors.push(`${row.email}: "${row.csvRole}" is not a valid role — valid values are ${validRoles.join(', ')}`)
        continue
      }

      let schoolId: string | undefined = undefined
      if (row.csvSchool) {
        const match = schools.find(s =>
          s.name.toLowerCase().includes(row.csvSchool!.toLowerCase()) ||
          row.csvSchool!.toLowerCase().includes(s.name.toLowerCase())
        )
        if (!match) {
          resolveErrors.push(`${row.email}: school "${row.csvSchool}" not found — update or remove this row`)
          continue
        }
        schoolId = match.id
      } else if (['teacher', 'staff'].includes(role)) {
        if (!bulkSchoolId) {
          resolveErrors.push(`${row.email}: role "${role}" requires a school — select a default school above`)
          continue
        }
        schoolId = bulkSchoolId
      }

      resolved.push({ firstName: row.firstName, lastName: row.lastName, email: row.email, phone: row.phone, role, schoolId })
    }

    if (resolveErrors.length > 0 && resolved.length === 0) {
      setBulkResults({ sent: 0, errors: resolveErrors })
      return
    }

    startTransition(async () => {
      const res = await bulkInviteUsers(resolved, bulkSendInvites)
      setBulkResults({ sent: res.sent, errors: [...resolveErrors, ...res.errors] })
      if (res.sent > 0) setBulkRows([])
    })
  }

  function handleCancelInvite(email: string) {
    if (!confirm(`Cancel the invite for ${email}? This will remove their pending account.`)) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set('email', email)
      const res = await cancelInvite(fd)
      if ('error' in res) showMessage(res.error ?? 'Failed to cancel invite', 'error')
      else showMessage(`Invite for ${email} cancelled.`, 'success')
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
      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Edit User</h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <div className="h-14 w-14 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                    {editAvatarUrl ? (
                      <Image src={editAvatarUrl} alt="" width={56} height={56} className="object-cover" />
                    ) : (
                      <span className="text-gray-600 text-lg font-bold">
                        {editForm.firstName?.[0]}{editForm.lastName?.[0]}
                      </span>
                    )}
                  </div>
                  <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-white border border-gray-200 p-1 shadow-sm hover:bg-gray-50">
                    <Camera className="h-3 w-3 text-gray-500" />
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                  </label>
                </div>
                <div className="text-xs text-gray-400">
                  {uploadingAvatar ? 'Uploading…' : 'Click the camera to upload a photo'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    value={editForm.firstName}
                    onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    value={editForm.lastName}
                    onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  placeholder="(555) 555-5555"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="teacher">Teacher</option>
                  <option value="substitute">Substitute</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="principal">School Admin</option>
                </select>
              </div>
              {['teacher', 'staff'].includes(editForm.role) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Schools</label>
                  <div className="space-y-2">
                    {schools.map(s => (
                      <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.schoolIds.includes(s.id)}
                          onChange={e => {
                            setEditForm(f => ({
                              ...f,
                              schoolIds: e.target.checked
                                ? [...f.schoolIds, s.id]
                                : f.schoolIds.filter(id => id !== s.id),
                            }))
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{s.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Reset Password — in body so it doesn't overflow the footer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reset Password</label>
                {tempPasswordUserId === editingUser.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      placeholder="New password (min 8 chars)"
                      value={tempPassValue}
                      onChange={e => setTempPassValue(e.target.value)}
                      className="text-sm border border-gray-300 rounded-md px-3 py-2 w-56 focus:outline-none focus:border-blue-500"
                    />
                    <button onClick={() => handleSetTempPassword(editingUser.id)} disabled={isPending}
                      className="text-sm text-blue-600 hover:underline">Set</button>
                    <button onClick={() => { setTempPasswordUserId(null); setTempPassValue('') }}
                      className="text-sm text-gray-400 hover:underline">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => { setTempPasswordUserId(editingUser.id); setTempPassValue('') }}
                    className="text-sm text-gray-400 hover:text-gray-700 underline">
                    Set a new password for this user
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              {(editingUser.role === 'admin' || editingUser.role === 'principal') ? (
                <p className="text-xs text-gray-400">To remove an admin, change their role to Staff or Teacher first.</p>
              ) : (
                <button
                  onClick={() => handleDelete(editingUser)}
                  disabled={isPending}
                  className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  Delete user permanently
                </button>
              )}
              <div className="flex gap-3 items-center">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isPending}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className={`rounded-lg border p-4 text-sm ${message.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

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
          <p className="text-xs text-blue-600">This link expires in 7 days.</p>
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
            <select name="role" required value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="teacher">Teacher</option>
              <option value="substitute">Substitute</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              School {['teacher', 'staff'].includes(inviteRole) && <span className="text-red-500">*</span>}
            </label>
            <select
              name="schoolId"
              required={['teacher', 'staff'].includes(inviteRole)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select a school —</option>
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

        {/* Bulk import toggle */}
        <div className="border-t border-gray-100 px-6 py-3">
          <button
            onClick={() => { setShowBulkImport(v => !v); setBulkResults(null); setBulkRows([]); setBulkParseError(null) }}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {showBulkImport ? '▲ Hide bulk import' : '▼ Bulk import from CSV'}
          </button>
        </div>

        {showBulkImport && (
          <div className="border-t border-gray-100 px-6 pb-6 space-y-4">
            <p className="text-sm text-gray-500 pt-4">
              Upload a CSV with columns: <code className="bg-gray-100 px-1 rounded text-xs">First Name, Last Name, Email, Phone, Role, School</code>.
              Role and School columns are optional — if omitted, the defaults below are used for every row.{' '}
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent('First Name,Last Name,Email,Phone,Role,School\nJohn,Smith,jsmith@school.edu,555-555-1234,Teacher,Northside Elementary School\nJane,Doe,jdoe@school.edu,,Substitute,Northside Elementary School\nBob,Jones,bjones@school.edu,,Admin,\nSarah,Lee,slee@school.edu,,Teacher,Northside High School')}`}
                download="subhub-import-template.csv"
                className="text-blue-600 hover:underline"
              >
                Download template
              </a>
            </p>
            <p className="text-xs text-blue-600">
              <a href="/help#login-options" className="hover:underline">
                Help: Click here for info on ways to use CSV import (including Google SSO setup)
              </a>
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default role <span className="text-gray-400 font-normal">(for rows with no Role column)</span></label>
                <select
                  value={bulkRole}
                  onChange={e => setBulkRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="teacher">Teacher</option>
                  <option value="substitute">Substitute</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default school <span className="text-gray-400 font-normal">(for teacher/staff rows with no School column)</span></label>
                <select
                  value={bulkSchoolId}
                  onChange={e => setBulkSchoolId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Select a school —</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CSV File</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleBulkFile}
                className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:bg-white file:text-gray-700 hover:file:bg-gray-50"
              />
            </div>

            {bulkParseError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-red-700">CSV Parse Warning</p>
                {bulkParseError.split('\n').map((line, i) => (
                  <p key={i} className="text-sm text-red-700">{line}</p>
                ))}
                {bulkRows.length > 0 && (
                  <p className="text-xs text-red-500">The {bulkRows.length} valid rows above will still be shown for import. Fix warnings before proceeding.</p>
                )}
              </div>
            )}

            {bulkRows.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">{bulkRows.length} people found — review before importing:</p>
                <div className="rounded border border-gray-200 overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-500 font-medium">Name</th>
                        <th className="text-left px-3 py-2 text-gray-500 font-medium">Email</th>
                        <th className="text-left px-3 py-2 text-gray-500 font-medium">Role</th>
                        <th className="text-left px-3 py-2 text-gray-500 font-medium">School</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bulkRows.map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-gray-900">{r.firstName} {r.lastName}</td>
                          <td className="px-3 py-2 text-gray-500">{r.email}</td>
                          <td className="px-3 py-2">
                            {r.csvRole
                              ? <span className="capitalize text-gray-900">{r.csvRole}</span>
                              : <span className="text-gray-400 italic capitalize">{bulkRole}</span>}
                          </td>
                          <td className="px-3 py-2">
                            {r.csvSchool
                              ? <span className="text-gray-900">{r.csvSchool}</span>
                              : bulkSchoolId
                                ? <span className="text-gray-400 italic">{schools.find(s => s.id === bulkSchoolId)?.name ?? '—'}</span>
                                : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => setBulkRows(rows => rows.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Send invites toggle */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkSendInvites}
                    onChange={e => setBulkSendInvites(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Send invite emails</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {bulkSendInvites
                        ? 'Each person receives an email with a link to set their password.'
                        : 'Accounts are created silently. Tell people to visit the app and use "Forgot Password" with their email to log in.'}
                    </p>
                  </div>
                </label>

                <button
                  onClick={handleBulkSubmit}
                  disabled={isPending}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Importing…' : `Import ${bulkRows.length} ${bulkSendInvites ? '(send invites)' : '(no emails)'}`}
                </button>
              </div>
            )}

            {bulkResults && (() => {
              const schoolErrors    = bulkResults.errors.filter(e => e.includes('school') && e.includes('not found'))
              const duplicateErrors = bulkResults.errors.filter(e => e.toLowerCase().includes('already registered') || e.toLowerCase().includes('email_exists') || e.toLowerCase().includes('already been registered'))
              const emailErrors     = bulkResults.errors.filter(e => e.toLowerCase().includes('invalid') && e.toLowerCase().includes('email'))
              const otherErrors     = bulkResults.errors.filter(e =>
                !schoolErrors.includes(e) && !duplicateErrors.includes(e) && !emailErrors.includes(e)
              )
              const allGood      = bulkResults.errors.length === 0

              return (
                <div className={`rounded-lg border p-4 space-y-3 text-sm ${allGood ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
                  {/* Header */}
                  <p className={`text-xs font-bold uppercase tracking-wider ${allGood ? 'text-green-700' : 'text-yellow-700'}`}>
                    CSV Import Status
                  </p>

                  {/* Success count */}
                  <p className={`font-semibold ${allGood ? 'text-green-800' : 'text-yellow-800'}`}>
                    ✓ {bulkResults.sent} {bulkResults.sent === 1 ? 'person' : 'people'} imported successfully.
                  </p>

                  {/* School mismatch pattern — grouped callout */}
                  {schoolErrors.length > 0 && (
                    <div className="rounded-md border border-orange-200 bg-orange-50 px-4 py-3 space-y-1">
                      <p className="font-semibold text-orange-800">
                        ⚠ {schoolErrors.length} {schoolErrors.length === 1 ? 'person was' : 'people were'} not imported — school name not found
                      </p>
                      <p className="text-xs text-orange-700">
                        The school names in your CSV don&apos;t match the school names in your account.
                        Go to <strong>Admin → Schools</strong> to see your exact school names, then update your CSV to match and re-import.
                      </p>
                      <details className="mt-1">
                        <summary className="text-xs text-orange-600 cursor-pointer hover:underline">Show affected rows ({schoolErrors.length})</summary>
                        <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs text-orange-700">
                          {schoolErrors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      </details>
                    </div>
                  )}

                  {/* Duplicate emails */}
                  {duplicateErrors.length > 0 && (
                    <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 space-y-1">
                      <p className="font-semibold text-blue-800">ℹ {duplicateErrors.length} {duplicateErrors.length === 1 ? 'person' : 'people'} already have accounts — skipped</p>
                      <p className="text-xs text-blue-700">These email addresses are already registered. If you need to update their role or school, use the Edit button on their user card instead.</p>
                      <details className="mt-1">
                        <summary className="text-xs text-blue-600 cursor-pointer hover:underline">Show skipped ({duplicateErrors.length})</summary>
                        <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs text-blue-700">
                          {duplicateErrors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      </details>
                    </div>
                  )}

                  {/* Invalid email format */}
                  {emailErrors.length > 0 && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 space-y-1">
                      <p className="font-semibold text-red-800">✕ {emailErrors.length} {emailErrors.length === 1 ? 'row has' : 'rows have'} an invalid email address</p>
                      <p className="text-xs text-red-700">Fix these email addresses in your CSV and re-import.</p>
                      <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs text-red-700">
                        {emailErrors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Other errors */}
                  {otherErrors.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-medium text-yellow-800">{otherErrors.length} other {otherErrors.length === 1 ? 'error' : 'errors'}:</p>
                      <ul className="space-y-0.5 list-disc list-inside text-xs text-yellow-800">
                        {otherErrors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}

                  {allGood && <p className="text-xs text-green-700">No errors — all rows imported successfully.</p>}
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* ── All Users ── */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">All Users ({users.length})</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-6 py-3 flex-wrap">
              <div className="flex-shrink-0">
                {u.avatarUrl ? (
                  <Image src={u.avatarUrl} alt="" width={32} height={32} className="rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                    {u.firstName[0]}{u.lastName[0]}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 text-sm">{u.lastName}, {u.firstName}</div>
                <div className="text-xs text-gray-400 truncate">{u.email}{u.phone && ` · ${u.phone}`}</div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                {ROLE_LABELS[u.role] ?? u.role}
              </span>
              {u.emailBounced && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full" title="Email bounced — delivery failed">
                  ⚠ Bad email
                </span>
              )}
              {u.status === 'inactive' && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactive</span>
              )}
              {(u.role !== 'admin' && u.role !== 'principal') && (
                u.status === 'inactive' ? (
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
                )
              )}
              <button
                onClick={() => openEditModal(u)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Quick-reference tips */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 space-y-1">
        <p><span className="font-semibold">Resetting a password:</span> Open a user&apos;s Edit panel and use the &quot;Reset password&quot; option in the form.</p>
        <p><span className="font-semibold">Removing an admin:</span> Admins cannot be deleted directly. First change their role to Staff or Teacher, then you can delete them.</p>
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
                <button
                  onClick={() => handleCancelInvite(inv.email)}
                  disabled={isPending}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Cancel
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
                <button
                  onClick={() => handleCancelInvite(inv.email)}
                  disabled={isPending}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Parses CSV text into rows. Returns an error string if the format is unrecognizable.
// Required columns: First Name, Last Name, Email. Optional: Phone.
function parseCsv(text: string): Array<{
  firstName: string; lastName: string; email: string
  phone?: string; csvRole?: string; csvSchool?: string
}> | string {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return 'File must have a header row and at least one data row.'

  const sep = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())

  const findCol = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)))
  const firstIdx  = findCol(['first'])
  const lastIdx   = findCol(['last'])
  const emailIdx  = findCol(['email'])
  const phoneIdx  = findCol(['phone', 'mobile', 'cell'])
  const roleIdx   = findCol(['role', 'position', 'type'])
  const schoolIdx = findCol(['school', 'campus', 'site'])

  const missing = []
  if (firstIdx === -1) missing.push('"First Name"')
  if (lastIdx  === -1) missing.push('"Last Name"')
  if (emailIdx === -1) missing.push('"Email"')
  if (missing.length > 0) {
    return `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Download the template to see the correct format.`
  }

  const rows: Array<{ firstName: string; lastName: string; email: string; phone?: string; csvRole?: string; csvSchool?: string }> = []
  const badEmails: string[] = []
  const unknownRoles: string[] = []
  const validRoles = ['admin', 'principal', 'staff', 'teacher', 'substitute', 'district']

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''))
    const firstName = cells[firstIdx]?.trim()
    const lastName  = cells[lastIdx]?.trim()
    const email     = cells[emailIdx]?.trim()
    if (!firstName || !lastName || !email) continue

    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
      badEmails.push(`Row ${i + 1}: "${email}" is not a valid email address`)
      continue
    }

    const phone     = phoneIdx  >= 0 ? cells[phoneIdx]?.trim()  || undefined : undefined
    const csvRole   = roleIdx   >= 0 ? cells[roleIdx]?.trim()   || undefined : undefined
    const csvSchool = schoolIdx >= 0 ? cells[schoolIdx]?.trim() || undefined : undefined

    // Warn about unrecognized roles (but still include the row — default role will apply)
    if (csvRole && !validRoles.includes(csvRole.toLowerCase())) {
      unknownRoles.push(`Row ${i + 1}: "${csvRole}" is not a valid role (valid: ${validRoles.join(', ')})`)
    }

    rows.push({ firstName, lastName, email, phone, csvRole, csvSchool })
  }

  if (badEmails.length > 0 || unknownRoles.length > 0) {
    // Return both the rows AND warnings as a special object
    return JSON.stringify({ rows, warnings: [...badEmails, ...unknownRoles] })
  }

  return rows.length === 0 ? 'No valid rows found. Check that your CSV has data rows below the header, and that names and emails are filled in.' : rows
}
