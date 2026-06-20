import { CalendarDays } from 'lucide-react'
import { getAbsencesForHeatmap } from '../../absences/actions'
import AbsenceHeatmapClient, { type AbsenceInfo, type DayData, type WeekData } from './AbsenceHeatmapClient'

function currentSchoolYear() {
  const now = new Date()
  const month = now.getMonth() + 1  // 1–12
  return month >= 8 ? now.getFullYear() : now.getFullYear() - 1
}

// Expands each absence into individual weekday dates within its range.
// A Mon–Wed absence becomes three separate entries in the map.
function expandAbsences(
  absences: Awaited<ReturnType<typeof getAbsencesForHeatmap>>
): Map<string, AbsenceInfo[]> {
  const map = new Map<string, AbsenceInfo[]>()

  for (const absence of absences) {
    const start = new Date(absence.startDate + 'T12:00:00')
    const end = absence.endDate
      ? new Date(absence.endDate + 'T12:00:00')
      : new Date(absence.startDate + 'T12:00:00')

    const cur = new Date(start)
    while (cur <= end) {
      const dow = cur.getDay()  // 0 = Sun, 6 = Sat
      if (dow !== 0 && dow !== 6) {
        const dateStr = cur.toLocaleDateString('en-CA')
        if (!map.has(dateStr)) map.set(dateStr, [])
        map.get(dateStr)!.push({
          teacherFirstName: absence.teacherFirstName,
          teacherLastName: absence.teacherLastName,
          reasonName: absence.reasonName,
        })
      }
      cur.setDate(cur.getDate() + 1)
    }
  }

  return map
}

// Builds the week grid for the school year (Aug 1 → Jun 30).
// Each week is an array of 5 DayData entries (Mon–Fri); null = outside year range.
function buildWeeks(startYear: number, dayMap: Map<string, AbsenceInfo[]>): WeekData[] {
  const from = new Date(`${startYear}-08-01T12:00:00`)
  const to = new Date(`${startYear + 1}-06-30T12:00:00`)

  // Find the Monday on or before Aug 1
  const firstMonday = new Date(from)
  const dow = firstMonday.getDay()
  const offset = dow === 0 ? -6 : 1 - dow  // negative = go back to Monday
  firstMonday.setDate(firstMonday.getDate() + offset)

  const weeks: WeekData[] = []
  const cur = new Date(firstMonday)

  while (cur <= to) {
    const days: DayData[] = []

    for (let d = 0; d < 5; d++) {
      const day = new Date(cur)
      day.setDate(day.getDate() + d)

      if (day >= from && day <= to) {
        const dateStr = day.toLocaleDateString('en-CA')
        days.push({
          date: dateStr,
          count: dayMap.get(dateStr)?.length ?? 0,
          absences: dayMap.get(dateStr) ?? [],
        })
      } else {
        days.push(null)
      }
    }

    // Skip entirely-empty weeks (e.g., before school starts)
    if (days.some(d => d !== null)) {
      weeks.push({ weekMonday: cur.toLocaleDateString('en-CA'), days })
    }

    cur.setDate(cur.getDate() + 7)
  }

  return weeks
}

export default async function AbsenceHeatmapPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year } = await searchParams
  const startYear = year ? parseInt(year) : currentSchoolYear()

  const from = `${startYear}-08-01`
  const to = `${startYear + 1}-06-30`

  const absences = await getAbsencesForHeatmap(from, to)
  const dayMap = expandAbsences(absences)
  const weeks = buildWeeks(startYear, dayMap)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Absence Calendar</h1>
          <p className="text-gray-500">
            Daily absence volume across the school year. Hover any day to see who was absent.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <AbsenceHeatmapClient
          weeks={weeks}
          startYear={startYear}
          totalAbsences={absences.length}
        />
      </div>
    </div>
  )
}
