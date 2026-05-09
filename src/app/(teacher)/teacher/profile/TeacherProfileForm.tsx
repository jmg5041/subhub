'use client'

import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { resizeImage } from '@/lib/resize-image'
import { saveAvatar } from '../../actions'

export function TeacherProfileForm({
  userId,
  firstName,
  lastName,
  email,
  phone,
  avatarUrl: initialAvatarUrl,
}: {
  userId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  avatarUrl: string | null
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialAvatarUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const initials = `${firstName[0]}${lastName[0]}`

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const resized = await resizeImage(file)
      const fd = new FormData()
      fd.append('file', resized, 'avatar.jpg')
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Upload failed')
      const { url } = await res.json()
      await saveAvatar(url)
      setPhotoUrl(url + '?t=' + Date.now())
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
      {/* Photo */}
      <div className="px-5 py-5 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <div className="h-16 w-16 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
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
          {error && <div className="text-xs text-red-500 mt-0.5">{error}</div>}
        </div>
      </div>

      {/* Name (read-only) */}
      <div className="px-5 py-4">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Name</label>
        <p className="text-sm text-gray-800">{firstName} {lastName}</p>
      </div>

      {/* Email (read-only) */}
      <div className="px-5 py-4">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Email</label>
        <p className="text-sm text-gray-800">{email}</p>
      </div>

      {/* Phone (read-only) */}
      <div className="px-5 py-4">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Phone</label>
        <p className="text-sm text-gray-800">{phone || <span className="text-gray-400">Not set</span>}</p>
      </div>
    </div>
  )
}
