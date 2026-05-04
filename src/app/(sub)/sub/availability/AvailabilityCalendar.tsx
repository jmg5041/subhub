'use client'

/**
 * Availability calendar — month grid where subs click dates to toggle unavailability.
 * White = available, gray striped = unavailable.
 */

import { useState, useTransition } from 'react'
import { toggleUnavailableDate } from '../../actions'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export default function AvailabilityCalendar({ initialUnavailableDates }: { initialUnavailableDates: string[] }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed
  const [unavailable, setUnavailable] = useState(new Set(initialUnavailableDates))
  const [isPending, startTransition] = useTransition()

  const todayStr = today.toISOString().split('T')[0]

  // Build the calendar grid
  const firstDay = new Date(year, month, 1).getDay() // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  function handleToggle(day: number) {
    const ds = dateStr(day)
    if (ds < todayStr) return // can't mark past dates

    startTransition(async () => {
      await toggleUnavailableDate(ds)
      setUnavailable(prev => {
        const next = new Set(prev)
        if (next.has(ds)) next.delete(ds)
        else next.add(ds)
        return next
      })
    })
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete the last row
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded text-gray-500">‹</button>
        <div className="font-semibold text-gray-900">{MONTHS[month]} {year}</div>
        <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded text-gray-500">›</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />

          const ds = dateStr(day)
          const isPast = ds < todayStr
          const isUnavailable = unavailable.has(ds)
          const isToday = ds === todayStr

          return (
            <button
              key={i}
              onClick={() => handleToggle(day)}
              disabled={isPast || isPending}
              className={`
                relative aspect-square flex items-center justify-center rounded text-sm font-medium transition-colors
                ${isPast ? 'text-gray-300 cursor-default' : 'cursor-pointer'}
                ${isToday ? 'ring-2 ring-blue-400' : ''}
                ${isUnavailable && !isPast
                  ? 'bg-gray-200 text-gray-500 line-through'
                  : !isPast
                  ? 'hover:bg-blue-50 text-gray-900'
                  : ''
                }
              `}
              title={isPast ? undefined : isUnavailable ? 'Click to mark available' : 'Click to mark unavailable'}
            >
              {day}
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded border border-gray-200 bg-white inline-block" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-gray-200 inline-block" />
          Unavailable
        </span>
      </div>
    </div>
  )
}
