'use client'

import { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { Globe, FileText, Star, MapPin } from 'lucide-react'
import { updateDirectoryVisibility, saveResume } from '../../actions'

export function GetHiredClient({
  firstName,
  lastName,
  avatarUrl,
  county,
  visibleInDirectory: initial,
  resumeUrl: initialResumeUrl,
  rating,
  ratingCount,
}: {
  firstName: string
  lastName: string
  avatarUrl: string | null
  county: string | null
  visibleInDirectory: boolean
  resumeUrl: string | null
  rating: number | null
  ratingCount: number
}) {
  const [visible, setVisible] = useState(initial)
  const [resumeUrl, setResumeUrl] = useState(initialResumeUrl)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const resumeInputRef = useRef<HTMLInputElement>(null)
  const initials = `${firstName[0]}${lastName[0]}`

  function handleToggle() {
    const next = !visible
    setVisible(next)
    startTransition(async () => {
      await updateDirectoryVisibility(next)
    })
  }

  async function handleResumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingResume(true)
    setResumeError(null)
    try {
      const fd = new FormData()
      fd.append('file', file, 'resume.pdf')
      const res = await fetch('/api/upload/resume', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Upload failed')
      const { url } = await res.json()
      await saveResume(url)
      setResumeUrl(url)
    } catch {
      setResumeError('Upload failed. Please try again.')
    } finally {
      setUploadingResume(false)
      if (resumeInputRef.current) resumeInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">

      {/* Hero banner */}
      <div className={`rounded-xl p-5 border transition-colors ${
        visible
          ? 'bg-orange-50 border-orange-200'
          : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`mt-0.5 rounded-full p-2.5 ${visible ? 'bg-orange-100' : 'bg-gray-200'}`}>
            <Globe className={`h-5 w-5 ${visible ? 'text-orange-500' : 'text-gray-400'}`} />
          </div>
          <div className="flex-1">
            <p className={`font-semibold ${visible ? 'text-orange-900' : 'text-gray-700'}`}>
              {visible ? 'You\'re listed in the directory' : 'You\'re not listed yet'}
            </p>
            <p className={`text-sm mt-0.5 ${visible ? 'text-orange-700' : 'text-gray-500'}`}>
              {visible
                ? `Schools browsing for substitutes in ${county ? county + ' County' : 'your county'} can see your profile and reach out to hire you.`
                : 'Turn on your listing and schools in your area can discover you when they need a substitute.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            className={`relative flex-shrink-0 inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 ${
              visible ? 'bg-orange-500' : 'bg-gray-300'
            }`}
            role="switch"
            aria-checked={visible}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              visible ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Preview card — what schools see */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Your listing preview — what schools see
          </p>
        </div>
        <div className="px-4 py-4 flex items-start gap-3">
          <div className="flex-shrink-0 h-11 w-11 rounded-full bg-orange-500 overflow-hidden flex items-center justify-center">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" width={44} height={44} className="object-cover w-full h-full" />
            ) : (
              <span className="text-white text-base font-bold">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">{firstName} {lastName}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
              {county && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <MapPin className="h-3 w-3" /> {county} County
                </span>
              )}
              {rating !== null && ratingCount > 0 ? (
                <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {rating.toFixed(1)} ({ratingCount} assignment{ratingCount !== 1 ? 's' : ''})
                </span>
              ) : (
                <span className="text-xs text-gray-400">No rating yet</span>
              )}
              {resumeUrl && (
                <a href={resumeUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                  <FileText className="h-3 w-3" /> Resume
                </a>
              )}
            </div>
          </div>
        </div>
        {!visible && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5">
            <p className="text-xs text-gray-400">Turn on your listing above to appear like this in the directory.</p>
          </div>
        )}
      </div>

      {/* Resume */}
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 space-y-2">
        <p className="text-sm font-semibold text-gray-700">Resume</p>
        <p className="text-xs text-gray-400">
          Upload a PDF resume. Schools can view it when browsing your profile.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          {resumeUrl ? (
            <a href={resumeUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
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

      {/* Rating */}
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 space-y-1">
        <p className="text-sm font-semibold text-gray-700">Your Rating</p>
        {rating !== null && ratingCount > 0 ? (
          <div className="flex items-center gap-2">
            <div className="flex">
              {[1,2,3,4,5].map(n => (
                <Star key={n} className={`h-5 w-5 ${n <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
              ))}
            </div>
            <span className="text-sm font-medium text-gray-900">{rating.toFixed(1)}</span>
            <span className="text-xs text-gray-400">based on {ratingCount} assignment{ratingCount !== 1 ? 's' : ''}</span>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No rating yet — ratings are assigned by school admins after you complete jobs.</p>
        )}
      </div>

    </div>
  )
}
