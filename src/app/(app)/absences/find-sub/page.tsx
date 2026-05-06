import Link from 'next/link'
import { UserSearch, CalendarDays, CheckCircle } from 'lucide-react'
import { getApprovedUnfilledAbsences } from '../actions'
import { formatDateRangeShort } from '@/lib/date-utils'

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  not_started: { label: 'Needs sub', class: 'bg-orange-100 text-orange-700' },
  sent:        { label: 'Notified', class: 'bg-blue-100 text-blue-700' },
  filled:      { label: 'Filled', class: 'bg-green-100 text-green-700' },
  not_needed:  { label: 'Not needed', class: 'bg-gray-100 text-gray-600' },
}

export default async function FindSubListPage() {
  const absences = await getApprovedUnfilledAbsences()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserSearch className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Find Substitute</h1>
          <p className="text-gray-500">Approved absences that need a substitute assigned</p>
        </div>
      </div>

      {absences.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-16 text-center">
          <CheckCircle className="h-12 w-12 text-green-400" />
          <p className="mt-4 text-lg font-medium text-gray-900">All covered!</p>
          <p className="mt-1 text-sm text-gray-500">No approved absences are waiting for a substitute.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-4 border-b border-gray-200 bg-gray-50 px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
            <span>Teacher</span>
            <span>School</span>
            <span>Date & Time</span>
            <span>Status</span>
            <span></span>
          </div>

          {absences.map((a) => {
            const status = STATUS_LABELS[a.subOutreachStatus ?? 'not_started'] ?? STATUS_LABELS.not_started
            return (
              <div key={a.id} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-center gap-4 border-b border-gray-100 px-6 py-4 last:border-0 hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">{a.teacherFirstName} {a.teacherLastName}</p>
                  {a.reasonName && <p className="text-xs text-gray-400">{a.reasonName}</p>}
                </div>
                <p className="text-sm text-gray-600">{a.schoolName}</p>
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                  {formatDateRangeShort(a.startDate, a.endDate)} · {formatTime(a.startTime)} – {formatTime(a.endTime)}
                </div>
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${status.class}`}>
                  {status.label}
                </span>
                <Link
                  href={`/absences/find-sub/${a.id}`}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors whitespace-nowrap"
                >
                  {a.subOutreachStatus === 'filled' ? 'Sub Details →' : 'Find Sub →'}
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
