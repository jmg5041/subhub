/**
 * Admin → Schools page.
 *
 * Lists all schools in the organization. Each school has an inline edit form
 * where admins can update the name, address, phone, website, and school hours.
 * This information is shown to substitutes on the school profile page.
 */

import { School } from 'lucide-react'
import { getOrgSchools } from '../actions'
import SchoolsClient from './SchoolsClient'

export default async function AdminSchoolsPage() {
  const schools = await getOrgSchools()
  const anySchoolConfigured = schools.some(s => s.phone || s.address)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <School className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schools</h1>
          <p className="text-gray-500">Manage school details shown to substitutes — address, hours, phone, and website.</p>
        </div>
      </div>

      {!anySchoolConfigured && (
        <div className="rounded-lg border-2 border-fuchsia-300 bg-fuchsia-50 px-5 py-4">
          <p className="font-semibold text-fuchsia-900">Step 4: Configure your school</p>
          <p className="text-sm text-fuchsia-700 mt-1">
            Click <strong>Edit</strong> on any school below and add a <strong>phone number</strong> or <strong>street address</strong>.
            This lets substitutes know how to reach the school and confirms your setup is complete.
          </p>
        </div>
      )}

      <SchoolsClient schools={schools} />
    </div>
  )
}
