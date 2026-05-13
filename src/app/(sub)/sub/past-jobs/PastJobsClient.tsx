'use client'

/**
 * Past Jobs client component — all completed assignments for this sub.
 * Filterable by school name. Timezone is passed from the server page wrapper.
 */

import { useEffect, useMemo, useState } from 'react'
import { getMyAssignments } from '../../actions'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, Search } from 'lucide-react'

type Assignment = Awaited<ReturnType<typeof getMyAssignments>>[number]

function formatDateLong(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}
function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default function PastJobsClient({ timezone }: { timezone: string }) {
  const [all, setAll] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [schoolFilter, setSchoolFilter] = useState('')

  useEffect(() => {
    getMyAssignments().then(rows => {
      const today   = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
      const nowTime = new Date().toLocaleTimeString('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit' })
      const pastRows = rows.filter(a => {
        if (a.date < today) return true
        if (a.date > today) return false
        return a.endTime.slice(0, 5) <= nowTime
      })
      // Most recent first
      setAll(pastRows.sort((a, b) => b.date.localeCompare(a.date)))
    }).finally(() => setLoading(false))
  }, [timezone])

  // Unique school names for the filter dropdown
  const schools = useMemo(() => {
    const names = [...new Set(all.map(a => a.school?.name).filter(Boolean))] as string[]
    return names.sort()
  }, [all])

  const filtered = all.filter(a =>
    !schoolFilter || a.school?.name === schoolFilter
  )

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/sub/dashboard" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Past Jobs</h1>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={schoolFilter}
            onChange={e => setSchoolFilter(e.target.value)}
            className="w-full appearance-none rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">All schools</option>
            {schools.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {schoolFilter && (
          <button
            onClick={() => setSchoolFilter('')}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </div>

      {loading && (
        <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-400">
          {all.length === 0 ? 'No completed jobs yet.' : 'No jobs match your filter.'}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 text-xs text-gray-400 font-medium uppercase tracking-wide">
            {filtered.length} job{filtered.length !== 1 ? 's' : ''}
            {schoolFilter ? ` at ${schoolFilter}` : ''}
          </div>
          <div className="divide-y divide-gray-100">
            {filtered.map(a => (
              <Link
                key={a.id}
                href={`/sub/dashboard/jobs/${a.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{a.school?.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{formatDateLong(a.date)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {formatTime(a.startTime)} – {formatTime(a.endTime)}
                    {Number(a.totalHours) > 0 && (
                      <span className="ml-2 text-gray-500 font-medium">{Number(a.totalHours).toFixed(1)} hrs</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
