'use client'

import { useRef, useState } from 'react'
import { Camera, ChevronDown, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateMyProfile, saveAvatar, saveResume } from '../../actions'

export function ProfileForm({
  userId,
  firstName,
  lastName,
  email,
  phone,
  county,
  counties,
  avatarUrl: initialAvatarUrl,
  resumeUrl: initialResumeUrl,
}: {
  userId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  county: string
  counties: string[]
  avatarUrl: string | null
  resumeUrl: string | null
}) {
  const [phoneVal, setPhoneVal] = useState(phone)
  const [countyVal, setCountyVal] = useState(county)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [photoUrl, setPhotoUrl] = useState<string | null>(initialAvatarUrl)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const [resumeUrl, setResumeUrl] = useState<string | null>(initialResumeUrl)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)

  const photoInputRef = useRef<HTMLInputElement>(null)
  const resumeInputRef = useRef<HTMLInputElement>(null)

  const initials = `${firstName[0]}${lastName[0]}`

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    setPhotoError(null)
    try {
      const supabase = createClient()
      const path = `avatars/${userId}`
      const { error: uploadError } = await supabase.storage
        .from('absence-attachments')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('absence-attachments').getPublicUrl(path)
      await saveAvatar(publicUrl)
      setPhotoUrl(publicUrl + '?t=' + Date.now())
    } catch {
      setPhotoError('Upload failed. Please try again.')
    } finally {
      setUploadingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  const handleResumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingResume(true)
    setResumeError(null)
    try {
      const supabase = createClient()
      const path = `resumes/${userId}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('absence-attachments')
        .upload(path, file, { upsert: true, contentType: 'application/pdf' })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('absence-attachments').getPublicUrl(path)
      await saveResume(publicUrl)
      setResumeUrl(publicUrl)
    } catch {
      setResumeError('Upload failed. Please try again.')
    } finally {
      setUploadingResume(false)
      if (resumeInputRef.current) resumeInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateMyProfile({ county: countyVal, phone: phoneVal })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
      {/* Photo */}
      <div className="px-5 py-5 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <div className="h-16 w-16 rounded-full overflow-hidden bg-orange-500 flex items-center justify-center">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-white text-xl font-bold">{initials}</span>
            )}
          </div>
          <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-white border border-gray-200 p-1 shadow-sm hover:bg-gray-50">
            <Camera className="h-3.5 w-3.5 text-gray-500" />
            <input
              ref={photoInputRef}
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
            {uploadingPhoto ? 'Uploading…' : 'Tap the camera to change your photo'}
          </div>
          {photoError && <div className="text-xs text-red-500 mt-0.5">{photoError}</div>}
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

      {/* Phone (editable) */}
      <div className="px-5 py-4">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
          Phone
        </label>
        <input
          type="tel"
          value={phoneVal}
          onChange={e => setPhoneVal(e.target.value)}
          placeholder="(555) 000-0000"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* County (editable) */}
      <div className="px-5 py-4">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
          County
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Your county is used to show you nearby schools in the Find Schools browser.
        </p>
        <div className="relative">
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={countyVal}
            onChange={e => setCountyVal(e.target.value)}
            className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">— Not set —</option>
            {counties.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Resume */}
      <div className="px-5 py-4">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Resume
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          {resumeUrl ? (
            <a
              href={resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              <FileText className="h-4 w-4" /> View Resume
            </a>
          ) : (
            <span className="text-sm text-gray-400">No resume uploaded</span>
          )}
          <label className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
            {resumeUrl ? 'Replace PDF' : 'Upload PDF'}
            <input
              ref={resumeInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleResumeChange}
            />
          </label>
          {uploadingResume && <span className="text-xs text-gray-400">Uploading…</span>}
          {resumeError && <span className="text-xs text-red-500">{resumeError}</span>}
        </div>
      </div>

      {/* Save button */}
      <div className="px-5 py-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  )
}
