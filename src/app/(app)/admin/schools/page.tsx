import { School } from 'lucide-react'
import { getOrgSchools, getOrgCampuses } from '../actions'
import SchoolsClient from './SchoolsClient'

export default async function AdminSchoolsPage() {
  const [schools, orgCampuses] = await Promise.all([getOrgSchools(), getOrgCampuses()])
  const anySchoolReady = schools.some(s => s.phone && s.timesConfigured)
  const anySchoolHasPhone = schools.some(s => s.phone)
  const schoolsNeedingSetup = schools.filter(s => !s.phone || !s.timesConfigured)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <School className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schools</h1>
          <p className="text-gray-500">Manage school details shown to substitutes — hours, phone, and website.</p>
        </div>
      </div>

      {!anySchoolReady && (
        <div className="rounded-lg border-2 border-fuchsia-300 bg-fuchsia-50 px-5 py-4 space-y-2">
          <p className="font-bold text-fuchsia-900">Step 4: Configure at least one school</p>
          <p className="text-sm text-fuchsia-700">
            Click <strong>Edit</strong> on any school and fill in two required fields:
          </p>
          <ul className="text-sm text-fuchsia-700 list-disc list-inside space-y-1">
            <li><strong>Main office phone number</strong> — shown to substitutes so they know who to call</li>
            <li><strong>School day start and end times</strong> — required and must be entered (no defaults). Used for absence scheduling and shown to substitutes.</li>
          </ul>
          <p className="text-sm text-fuchsia-700">Click <strong>Save</strong>. Step 4 completes automatically.</p>
          {schoolsNeedingSetup.length > 0 && (
            <p className="text-xs text-fuchsia-600 font-medium">
              Needs setup: {schoolsNeedingSetup.map(s => s.name).join(' · ')}
            </p>
          )}
        </div>
      )}

      <SchoolsClient schools={schools} campuses={orgCampuses} showPhoneRequired={!anySchoolHasPhone} />
    </div>
  )
}
