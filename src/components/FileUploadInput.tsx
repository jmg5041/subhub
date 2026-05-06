/**
 * FileUploadInput — lets admin attach files (lesson plans, PDFs, images) to an absence.
 *
 * How it works:
 *   1. User clicks "Attach a file" and picks a file (PDF, Word, or image, max 10MB)
 *   2. File uploads immediately to Supabase Storage (absence-attachments bucket)
 *   3. A "chip" appears showing the filename — clicking X removes it
 *   4. When the absence form is submitted, the parent passes the uploaded file
 *      info to the server action which saves a row in the attachments table.
 *
 * Props:
 *   orgId    — used as the storage folder prefix so files stay organized
 *   userId   — added to the filename so we know who uploaded
 *   value    — array of already-uploaded files (controlled component)
 *   onChange — called with the updated array whenever a file is added or removed
 */

'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Paperclip, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'

export type UploadedFile = {
  fileName: string
  fileUrl: string
  fileSize: number
  fileType: string // 'pdf' | 'image' | 'doc' | 'other'
}

const BUCKET = 'absence-attachments'
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export function FileUploadInput({
  orgId,
  userId,
  value,
  onChange,
}: {
  orgId: string
  userId: string
  value: UploadedFile[]
  onChange: (files: UploadedFile[]) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_BYTES) {
      setError('File must be under 10 MB')
      return
    }

    setError('')
    setUploading(true)

    // Build a unique path so two files with the same name don't collide
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${orgId}/${userId}-${Date.now()}-${safeName}`

    const { data, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false })

    if (uploadError || !data) {
      setError('Upload failed — please try again.')
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path)

    const fileType = file.type.startsWith('image/')
      ? 'image'
      : file.type === 'application/pdf'
      ? 'pdf'
      : file.name.match(/\.docx?$/i)
      ? 'doc'
      : 'other'

    onChange([...value, { fileName: file.name, fileUrl: publicUrl, fileSize: file.size, fileType }])
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeFile(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {/* Uploaded file chips */}
      {value.map((file, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
        >
          {file.fileType === 'image' ? (
            <ImageIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
          ) : (
            <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
          )}
          <a
            href={file.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 truncate text-sm text-blue-600 hover:underline"
          >
            {file.fileName}
          </a>
          <span className="flex-shrink-0 text-xs text-gray-400">
            {(file.fileSize / 1024).toFixed(0)} KB
          </span>
          <button
            type="button"
            onClick={() => removeFile(i)}
            className="flex-shrink-0 text-gray-400 hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      {/* File picker */}
      <div>
        <input
          ref={inputRef}
          id="file-upload-input"
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
        />
        <label
          htmlFor="file-upload-input"
          className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-600 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 ${uploading ? 'cursor-not-allowed opacity-60' : ''}`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Paperclip className="h-4 w-4" />
              Attach a file
            </>
          )}
        </label>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        <p className="mt-1 text-xs text-gray-400">PDF, Word, or image · max 10 MB</p>
      </div>
    </div>
  )
}
