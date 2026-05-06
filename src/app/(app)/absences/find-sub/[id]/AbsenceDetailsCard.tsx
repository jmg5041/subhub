/**
 * AbsenceDetailsCard — the full info card shown at the top of the Absence Details page.
 *
 * This is a "client component" so it can be interactive. It shows:
 *   • Teacher name, school, date/time, and reason — always read-only
 *   • Notes for Substitute — editable inline (click the pencil icon)
 *   • Attachments — add new files or delete existing ones
 *
 * When you click the pencil icon next to "Notes for Substitute," a text box
 * appears. Edit the notes and click Save. The change goes straight to the database.
 *
 * For attachments, files upload directly to Supabase Storage (the bucket)
 * and then a record is saved to the database. Clicking X on a file removes
 * it from the database (the file stays in storage but is no longer linked).
 */

'use client'

import { useState, useTransition } from 'react'
import {
  Pencil, Check, X, FileText, Image as ImageIcon, Loader2, AlertTriangle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { FileUploadInput, type UploadedFile } from '@/components/FileUploadInput'
import {
  updateNotesToSub,
  saveAbsenceAttachment,
  deleteAttachment,
  unapproveAbsence,
} from '../../actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type Attachment = {
  id: string
  fileName: string
  fileUrl: string
  fileSize: number | null
  fileType: string | null
}

type Props = {
  timeOffId: string
  teacherName: string
  schoolName: string
  date: string           // formatted string, e.g. 'Monday, May 10, 2026' or 'May 10 – 14, 2026'
  dayCount: number       // number of school days (1 for single-day absences)
  timeRange: string      // formatted string, e.g. '7:45 AM – 3:15 PM'
  reasonName?: string | null
  substituteRequired: boolean
  isAlreadyFilled: boolean
  approvalStatus: string // 'unapproved' | 'approved' | 'denied'
  notesToSub: string | null
  requestedSubName?: string | null
  initialAttachments: Attachment[]
  orgId: string
  userId: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AbsenceDetailsCard({
  timeOffId,
  teacherName,
  schoolName,
  date,
  dayCount,
  timeRange,
  reasonName,
  substituteRequired,
  isAlreadyFilled,
  approvalStatus,
  notesToSub: initialNotes,
  requestedSubName,
  initialAttachments,
  orgId,
  userId,
}: Props) {
  const router = useRouter()
  // ── Notes state ──
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft]         = useState(initialNotes ?? '')
  const [savedNotes, setSavedNotes]         = useState(initialNotes ?? '')
  const [notesSaving, startNotesSave]       = useTransition()
  const [notesError, setNotesError]         = useState('')

  // ── Unapprove state ──
  const [unapproving, startUnapprove]  = useTransition()
  const [unapproveError, setUnapproveError] = useState('')
  // Show the cancel button only when approved and no sub is filled yet
  const canUnapprove = approvalStatus === 'approved' && !isAlreadyFilled

  function handleUnapprove() {
    if (!confirm(
      'Cancel approval for this absence?\n\nIt will move back to "Pending Approval." ' +
      'You can re-approve it at any time from the Approve Absences page.'
    )) return
    setUnapproveError('')
    startUnapprove(async () => {
      const result = await unapproveAbsence(timeOffId)
      if ('error' in result) {
        setUnapproveError(result.error ?? 'Failed to cancel — please try again.')
      } else {
        router.push('/absences/approve')
      }
    })
  }

  // ── Attachments state ──
  // Start with whatever was already saved when the page loaded
  const [attachmentsList, setAttachmentsList] = useState<Attachment[]>(initialAttachments)
  // Holds the in-flight upload so FileUploadInput can show its progress chip,
  // then we reset it to [] once the DB row is saved
  const [pendingUploads, setPendingUploads] = useState<UploadedFile[]>([])
  const [attachSaving, startAttachSave]    = useTransition()
  const [attachError, setAttachError]      = useState('')

  // ── Save notes ──
  function handleSaveNotes() {
    setNotesError('')
    startNotesSave(async () => {
      const result = await updateNotesToSub(timeOffId, notesDraft)
      if ('error' in result) {
        setNotesError('Failed to save — please try again.')
      } else {
        setSavedNotes(notesDraft)
        setIsEditingNotes(false)
      }
    })
  }

  function handleCancelNotes() {
    setNotesDraft(savedNotes) // revert to last saved value
    setIsEditingNotes(false)
    setNotesError('')
  }

  // ── Add attachment (called after FileUploadInput finishes uploading) ──
  function handleFileUploaded(files: UploadedFile[]) {
    if (files.length === 0) return
    const newFile = files[files.length - 1]
    setAttachError('')

    startAttachSave(async () => {
      const result = await saveAbsenceAttachment(timeOffId, newFile)
      if ('error' in result || !result.attachment) {
        setAttachError('Failed to save file — please try again.')
      } else {
        setAttachmentsList(prev => [...prev, {
          id: result.attachment!.id,
          fileName: result.attachment!.fileName,
          fileUrl: result.attachment!.fileUrl,
          fileSize: result.attachment!.fileSize,
          fileType: result.attachment!.fileType,
        }])
      }
      // Reset the upload input regardless so it's ready for the next file
      setPendingUploads([])
    })
  }

  // ── Delete attachment ──
  function handleDeleteAttachment(id: string) {
    if (!confirm('Remove this attachment?')) return
    setAttachError('')

    startAttachSave(async () => {
      const result = await deleteAttachment(id)
      if ('error' in result) {
        setAttachError('Failed to remove — please try again.')
      } else {
        setAttachmentsList(prev => prev.filter(a => a.id !== id))
      }
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">

      {/* ── Header: teacher + badges ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-gray-900">{teacherName}</div>
          <div className="text-sm text-gray-500">{schoolName}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {reasonName && (
            <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full whitespace-nowrap">
              {reasonName}
            </span>
          )}
          {!substituteRequired && (
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full whitespace-nowrap">
              Covered by Staff
            </span>
          )}
          {isAlreadyFilled && substituteRequired && (
            <span className="text-xs font-medium bg-green-100 text-green-700 px-2.5 py-1 rounded-full whitespace-nowrap">
              Filled by Sub
            </span>
          )}
        </div>
      </div>

      {/* ── Date / Time ── */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100">
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
            {dayCount > 1 ? `Date Range (${dayCount} school days)` : 'Date'}
          </div>
          <div className="text-sm font-medium text-gray-800">{date}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Daily Hours</div>
          <div className="text-sm font-medium text-gray-800">{timeRange}</div>
        </div>
      </div>

      {/* ── Notes for Substitute ── */}
      <div className="pt-1 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Notes for Substitute</span>
          {!isEditingNotes && (
            <button
              type="button"
              onClick={() => setIsEditingNotes(true)}
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
            >
              <Pencil className="h-3 w-3" />
              {savedNotes ? 'Edit' : 'Add notes'}
            </button>
          )}
        </div>

        {isEditingNotes ? (
          <div className="space-y-2">
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={4}
              placeholder="E.g. Class is 3rd period, room 204. Lesson plans are on the desk..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y"
            />
            {notesError && <p className="text-xs text-red-600">{notesError}</p>}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={notesSaving}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {notesSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </button>
              <button
                type="button"
                onClick={handleCancelNotes}
                disabled={notesSaving}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </div>
          </div>
        ) : savedNotes ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{savedNotes}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">No notes added yet.</p>
        )}
      </div>

      {/* ── Attachments ── */}
      <div className="pt-1 border-t border-gray-100">
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Attachments</div>

        {/* Existing files */}
        <div className="space-y-1.5 mb-3">
          {attachmentsList.length === 0 && pendingUploads.length === 0 && (
            <p className="text-sm text-gray-400 italic">No files attached yet.</p>
          )}
          {attachmentsList.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              {a.fileType === 'image' ? (
                <ImageIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
              ) : (
                <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
              )}
              <a
                href={a.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-sm text-blue-600 hover:underline"
              >
                {a.fileName}
              </a>
              {a.fileSize && (
                <span className="flex-shrink-0 text-xs text-gray-400">
                  {(a.fileSize / 1024).toFixed(0)} KB
                </span>
              )}
              <button
                type="button"
                onClick={() => handleDeleteAttachment(a.id)}
                disabled={attachSaving}
                className="flex-shrink-0 text-gray-400 hover:text-red-500 disabled:opacity-40"
                title="Remove attachment"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Upload new file */}
        <FileUploadInput
          orgId={orgId}
          userId={userId}
          value={pendingUploads}
          onChange={handleFileUploaded}
        />
        {attachError && <p className="mt-1 text-xs text-red-600">{attachError}</p>}
      </div>

      {/* ── Requested sub (if any) ── */}
      {requestedSubName && (
        <div className="pt-1 border-t border-gray-100">
          <div className="text-xs text-orange-500 uppercase tracking-wide mb-0.5">
            Specifically requested
          </div>
          <div className="text-sm font-medium text-gray-800">{requestedSubName}</div>
        </div>
      )}

      {/* ── Cancel Approval ── */}
      {canUnapprove && (
        <div className="pt-3 border-t border-gray-100">
          {unapproveError && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500" />
              <p className="text-xs text-red-700">{unapproveError}</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleUnapprove}
            disabled={unapproving}
            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {unapproving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            {unapproving ? 'Cancelling…' : 'Cancel Approval'}
          </button>
          <p className="mt-0.5 text-xs text-gray-400">
            Moves this absence back to Pending Approval. Only available before a sub is assigned.
          </p>
        </div>
      )}
    </div>
  )
}
