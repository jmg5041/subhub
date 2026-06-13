'use client'

import { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { Camera } from 'lucide-react'
import { resizeImage } from '@/lib/resize-image'
import { saveAvatar, saveTeacherProfile } from '../../actions'

export function TeacherProfileForm({
  userId,
  firstName: initialFirstName,
  lastName: initialLastName,
  email,
  phone: initialPhone,
  avatarUrl: initialAvatarUrl,
}: {
  userId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  avatarUrl: string | null
}) {
  const [photoUrl, setPhotoUrl]       = useState<string | null>(initialAvatarUrl)
  const [uploading, setUploading]     = useState(false)
  const [photoError, setPhotoError]   = useState<string | null>(null)
  const inputRef                      = useRef<HTMLInputElement>(null)

  const [firstName, setFirstName]     = useState(initialFirstName)
  const [lastName, setLastName]       = useState(initialLastName)
  const [phone, setPhone]             = useState(initialPhone)
  const [saved, setSaved]             = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  const initials = `${firstName[0] ?? '?'}${lastName[0] ?? ''}`

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
      await saveAvatar(url)
      setPhotoUrl(url)
    } catch {
      setPhotoError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleSave = () => {
    if (!firstName.trim() || !lastName.trim()) return
    setSaved(false)
    setSaveError(null)
    startTransition(async () => {
      try {
        await saveTeacherProfile({ firstName, lastName, phone })
        setSaved(true)
      } catch {
        setSaveError('Save failed. Please try again.')
      }
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
      {/* Photo */}
      <div className="px-5 py-5 flex items-center gap-4">
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
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </label>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">{firstName} {lastName}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {uploading ? 'Uploading…' : 'Tap the camera to change your photo'}
          </div>
          {photoError && <div className="text-xs text-red-500 mt-0.5">{photoError}</div>}
        </div>
      </div>

      {/* First name */}
      <div className="px-5 py-4">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
          First Name
        </label>
        <input
          type="text"
          value={firstName}
          onChange={(e) => { setFirstName(e.target.value); setSaved(false) }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Last name */}
      <div className="px-5 py-4">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
          Last Name
        </label>
        <input
          type="text"
          value={lastName}
          onChange={(e) => { setLastName(e.target.value); setSaved(false) }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Email — read-only, controlled by admin */}
      <div className="px-5 py-4">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
          Email
        </label>
        <p className="text-sm text-gray-500">{email}</p>
        <p className="text-xs text-gray-400 mt-0.5">Contact your administrator to change your email.</p>
      </div>

      {/* Phone */}
      <div className="px-5 py-4">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
          Phone
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setSaved(false) }}
          placeholder="(555) 555-5555"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Save button */}
      <div className="px-5 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !firstName.trim() || !lastName.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
        {saveError && <span className="text-sm text-red-600">{saveError}</span>}
      </div>
    </div>
  )
}
