/**
 * Sub Job Detail page — full details for one accepted assignment.
 *
 * Shows:
 *   • School name (links to school profile) + address (links to Google Maps)
 *   • Date and daily hours
 *   • Teacher's notes for the substitute
 *   • Any file attachments the teacher or admin uploaded
 *   • Status badge (upcoming / today / completed)
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Clock, FileText, Image as ImageIcon, CalendarDays, ExternalLink } from 'lucide-react'
import { getMyAssignmentById } from '../../../../actions'
import { formatDateRange, countWeekdays } from '@/lib/date-utils'

function formatTime(t: string): string {
  const [hourStr, min] = t.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:${min} ${ampm}`
}

function mapsUrl(school: { address?: string | null; city?: string | null; state?: string | null; name: string }): string {
  const query = [school.address, school.city, school.state].filter(Boolean).join(', ') || school.name
  return `https://maps.google.com/?q=${encodeURIComponent(query)}`
}

function getJobStatus(date: string, status: string): { label: string; color: string } {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  if (status === 'cancelled') return { label: 'Cancelled', color: 'bg-red-100 text-red-700' }
  if (date < today) return { label: 'Completed', color: 'bg-gray-100 text-gray-600' }
  if (date === today) return { label: 'Today', color: 'bg-green-100 text-green-700' }
  return { label: 'Upcoming', color: 'bg-blue-100 text-blue-700' }
}

export default async function SubJobDetailPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>
}) {
  const { assignmentId } = await params
  const assignment = await getMyAssignmentById(assignmentId)
  if (!assignment) notFound()

  const school = assignment.school
  const { label: statusLabel, color: statusColor } = getJobStatus(assignment.date, assignment.status ?? '')

  // Collect all time-off records linked to this assignment
  const timeOffRecords = assignment.timeOffLinks
    .map(l => l.timeOff)
    .filter(Boolean)

  // Merge all attachments from all linked absences
  const allAttachments = timeOffRecords.flatMap(t => t?.attachments ?? [])

  // Collect teacher notes (may be from multiple teachers if covering a gap)
  const notesEntries = timeOffRecords
    .filter(t => t?.notesToSub)
    .map(t => ({
      teacherName: t?.employee?.user
        ? `${t.employee.user.firstName} ${t.employee.user.lastName}`
        : 'Teacher',
      notes: t!.notesToSub!,
    }))

  // Date range from the linked absence (the assignment itself stores startDate of the assignment)
  const primaryTimeOff = timeOffRecords[0]
  const startDate = primaryTimeOff?.startDate ?? assignment.date
  const endDate = primaryTimeOff?.endDate ?? null
  const dayCount = countWeekdays(startDate, endDate)

  return (
    <div className="max-w-lg mx-auto space-y-5 py-6 px-4">
      {/* Back */}
      <Link href="/sub/dashboard" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600">
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Job Details</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatDateRange(startDate, endDate)}</p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* School card */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
        {/* School name → school profile */}
        <Link
          href={`/sub/schools/${school.id}`}
          className="text-lg font-semibold text-blue-600 hover:underline flex items-center gap-1.5"
        >
          {school.name}
          <ExternalLink className="h-4 w-4 flex-shrink-0 opacity-60" />
        </Link>

        {/* Address → Google Maps */}
        {school.address && (
          <a
            href={mapsUrl(school)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 text-sm text-gray-600 hover:text-blue-600 group"
          >
            <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5 text-gray-400 group-hover:text-blue-500" />
            <span>
              {school.address}
              {school.city && `, ${school.city}`}
              {school.state && `, ${school.state}`}
              {school.zip && ` ${school.zip}`}
            </span>
          </a>
        )}

        {/* Date & hours */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
              {dayCount > 1 ? `Date Range (${dayCount} days)` : 'Date'}
            </div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
              <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
              {formatDateRange(startDate, endDate)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Daily Hours</div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              {formatTime(assignment.startTime)} – {formatTime(assignment.endTime)}
            </div>
          </div>
        </div>

        {/* Total hours (for multi-day) */}
        {Number(assignment.totalHours) > 0 && (
          <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-blue-800">
            Total: <strong>{Number(assignment.totalHours).toFixed(1)} hours</strong>
            {dayCount > 1 && ` across ${dayCount} school days`}
          </div>
        )}
      </div>

      {/* Notes from teacher(s) */}
      {notesEntries.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Notes for You
          </h2>
          {notesEntries.map((entry, i) => (
            <div key={i}>
              {notesEntries.length > 1 && (
                <p className="text-xs text-gray-400 mb-1">{entry.teacherName}</p>
              )}
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.notes}</p>
            </div>
          ))}
        </div>
      )}

      {/* Attachments */}
      {allAttachments.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Files & Lesson Plans
          </h2>
          <div className="space-y-2">
            {allAttachments.map((a) => (
              <a
                key={a.id}
                href={a.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 hover:bg-blue-50 hover:border-blue-200 transition-colors group"
              >
                {a.fileType === 'image' ? (
                  <ImageIcon className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-500" />
                ) : (
                  <FileText className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-500" />
                )}
                <span className="flex-1 truncate text-sm text-blue-600 group-hover:underline">
                  {a.fileName}
                </span>
                {a.fileSize && (
                  <span className="flex-shrink-0 text-xs text-gray-400">
                    {(a.fileSize / 1024).toFixed(0)} KB
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {notesEntries.length === 0 && allAttachments.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-400">
          No notes or files have been added for this job yet.
        </div>
      )}
    </div>
  )
}
