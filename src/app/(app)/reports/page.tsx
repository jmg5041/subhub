import Link from 'next/link'
import { FileBarChart, DollarSign, UserX, TrendingUp, CalendarDays } from 'lucide-react'

const reports = [
  {
    title: 'Sub Pay Report',
    description: 'Hours worked by each substitute for a date range. Export to CSV for payroll.',
    href: '/reports/sub-pay',
    icon: DollarSign,
    available: true,
  },
  {
    title: 'Teacher Absence Summary',
    description: 'Days absent per teacher, broken down by reason. Filter by individual teacher.',
    href: '/reports/teacher-absences',
    icon: UserX,
    available: true,
  },
  {
    title: 'Fill Rate Report',
    description: 'What % of absences were filled by a substitute, with a list of unfilled positions.',
    href: '/reports/fill-rate',
    icon: TrendingUp,
    available: true,
  },
  {
    title: 'Absence Calendar',
    description: 'Daily absence volume across the school year. Hover any day to see who was absent.',
    href: '/reports/absence-heatmap',
    icon: CalendarDays,
    available: true,
  },
]

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileBarChart className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500">Absence, substitute, and payroll reports</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {reports.map((report) => {
          const Icon = report.icon
          return report.available ? (
            <Link
              key={report.title}
              href={report.href}
              className="group flex gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 group-hover:bg-blue-100">
                <Icon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 group-hover:text-blue-700">{report.title}</p>
                <p className="mt-0.5 text-sm text-gray-500">{report.description}</p>
              </div>
            </Link>
          ) : (
            <div
              key={report.title}
              className="flex gap-4 rounded-lg border border-gray-100 bg-gray-50 p-5"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                <Icon className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-400">{report.title}</p>
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-500">Coming soon</span>
                </div>
                <p className="mt-0.5 text-sm text-gray-400">{report.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
