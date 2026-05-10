'use client'

import { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { Camera } from 'lucide-react'
import { resizeImage } from '@/lib/resize-image'
import { saveAdminProfile, saveAdminAvatar } from './actions'

type Props = {
  firstName: string
  lastName: string
  email: string
  phone: string | null
  role: string
  avatarUrl: string | null
}

export default function AdminProfileForm({ firstName, lastName, email, phone, role, avatarUrl: initialAvatarUrl }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialAvatarUrl)
  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const [first, setFirst] = useState(firstName)
  const [last, setLast] = useState(lastName)
  const [phoneVal, setPhoneVal] = useState(phone ?? '')
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const initials = `${first[0] ?? ''}${last[0] ?? ''}`

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setPhotoError(null)
    try {
      const resized = await resizeImage(file)
      const fd = new FormData()
      fd.append('file', resized, 'avatar.jpg')
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Upload failed')
      const { url } = await res.json()
      await saveAdminAvatar(url)
      setPhotoUrl(url)
    } catch {
      setPhotoError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleSave() {
    setSaveError(null)
    startTransition(async () => {
      const result = await saveAdminProfile({ firstName: first, lastName: last, phone: phoneVal })
      if ('error' in result) {
        setSaveError(result.error as string)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    })
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Avatar */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center">
              {photoUrl ? (
                <Image src={photoUrl} alt="" width={64} height={64} className="object-cover" />
              ) : (
                <span className="text-white text-xl font-bold">{initials}</span>
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-white border border-gray-200 p-1 shadow-sm hover:bg-gray-50">
              <Camera className="h-3.5 w-3.5 text-gray-500" />
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{first} {last}</div>
            <div className="text-xs text-gray-400 capitalize mt-0.5">{role}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {uploading ? 'Uploading…' : 'Tap the camera to change your photo'}
            </div>
            {photoError && <div className="text-xs text-red-500 mt-0.5">{photoError}</div>}
          </div>
        </div>
      </div>

      {/* Editable fields */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Personal Information</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">First Name</label>
            <input
              type="text"
              value={first}
              onChange={e => setFirst(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Last Name</label>
            <input
              type="text"
              value={last}
              onChange={e => setLast(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Email</label>
          <p className="text-sm text-gray-800 py-2">{email}</p>
          <p className="text-xs text-gray-400">To change your email, contact your system administrator.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Phone</label>
          <input
            type="tel"
            value={phoneVal}
            onChange={e => setPhoneVal(e.target.value)}
            placeholder="(555) 555-1234"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {saveError && <p className="text-sm text-red-500">{saveError}</p>}

        <div className="flex items-center gap-4 pt-1">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
        </div>
      </div>
    </div>
  )
}
