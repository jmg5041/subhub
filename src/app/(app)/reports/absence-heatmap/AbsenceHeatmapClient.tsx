'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type AbsenceInfo = {
  teacherFirstName: string | null
  teacherLastName: string | null
  reasonName: string | null
}

export type DayData = {
  date: string       // YYYY-MM-DD
  count: number
  absences: AbsenceInfo[]
} | null

export type WeekData = {
  weekMonday: string  // YYYY-MM-DD, used for month label detection
  days: DayData[]    // always 5 entries: Mon–Fri; null = outside school year
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F']

function countToColor(count: number) {
  if (count === 0) return 'bg-gray-100'
  if (count <= 2) return 'bg-purple-200'
  if (count <= 4) return 'bg-purple-400'
  if (count <= 6) return 'bg-purple-600'
  return 'bg-purple-900'
}

function formatTooltipDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function getMonthLabel(week: WeekData, weekIndex: number, weeks: WeekData[]): string | null {
  const firstDay = week.days.find(d => d !== null)
  if (!firstDay) return null
  const month = parseInt(firstDay.date.split('-')[1]) - 1

  if (weekIndex === 0) return MONTH_NAMES[month]

  const prevFirstDay = weeks[weekIndex - 1].days.find(d => d !== null)
  if (!prevFirstDay) return MONTH_NAMES[month]
  const prevMonth = parseInt(prevFirstDay.date.split('-')[1]) - 1

  return month !== prevMonth ? MONTH_NAMES[month] : null
}

type TooltipState = {
  date: string
  count: number
  absences: AbsenceInfo[]
  x: number
  y: number
}

export default function AbsenceHeatmapClient({
  weeks,
  startYear,
  totalAbsences,
}: {
  weeks: WeekData[]
  startYear: number
  totalAbsences: number
}) {
  const router = useRouter()
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const currentSchoolYear = currentMonth >= 8 ? currentYear : currentYear - 1
  const availableYears = Array.from(
    { length: currentSchoolYear - 2022 },
    (_, i) => 2023 + i
  )

  return (
    <div className="space-y-5">
      {/* Controls row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">School year</label>
          <select
            value={startYear}
            onChange={e => router.push(`/reports/absence-heatmap?year=${e.target.value}`)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-500 focus:outline-none"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}–{y + 1}</option>
            ))}
          </select>
        </div>
        <span className="text-sm text-gray-500">{totalAbsences} total absences</span>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex gap-0.5 pt-6">
          {/* Day-of-week labels on the left */}
          <div className="flex flex-col gap-0.5 mr-2">
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="h-3.5 w-3 text-xs text-gray-400 flex items-center justify-end"
              >
                {/* Only show Mon / Wed / Fri to avoid crowding */}
                {i % 2 === 0 ? label : ''}
              </div>
            ))}
          </div>

          {/* Week columns */}
          {weeks.map((week, wi) => {
            const monthLabel = getMonthLabel(week, wi, weeks)
            return (
              <div key={wi} className="relative flex flex-col gap-0.5">
                {monthLabel && (
                  <span className="absolute -top-5 left-0 text-xs text-gray-400 whitespace-nowrap select-none">
                    {monthLabel}
                  </span>
                )}
                {week.days.map((day, di) =>
                  day ? (
                    <div
                      key={di}
                      className={`h-3.5 w-3.5 rounded-sm cursor-default transition-opacity hover:opacity-75 ${countToColor(day.count)}`}
                      onMouseEnter={e => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setTooltip({
                          date: day.date,
                          count: day.count,
                          absences: day.absences,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                        })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  ) : (
                    <div key={di} className="h-3.5 w-3.5" />
                  )
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <span>Fewer absences</span>
        {[0, 1, 3, 5, 7].map(n => (
          <div key={n} className={`h-3 w-3 rounded-sm ${countToColor(n)}`} />
        ))}
        <span>More absences</span>
      </div>

      {/* Tooltip — fixed position, follows cursor */}
      {tooltip && tooltip.count > 0 && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2.5 shadow-xl max-w-56"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <p className="font-semibold mb-1">{formatTooltipDate(tooltip.date)}</p>
          <p className="text-purple-300 mb-1.5">
            {tooltip.count} absence{tooltip.count !== 1 ? 's' : ''}
          </p>
          {tooltip.absences.slice(0, 7).map((a, i) => (
            <p key={i} className="text-gray-300">
              {a.teacherFirstName} {a.teacherLastName}
              {a.reasonName ? <span className="text-gray-500"> · {a.reasonName}</span> : null}
            </p>
          ))}
          {tooltip.absences.length > 7 && (
            <p className="text-gray-500 mt-0.5">+{tooltip.absences.length - 7} more</p>
          )}
        </div>
      )}
    </div>
  )
}
