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
  const anySchoolHasPhone = schools.some(s => s.phone)
  const schoolsMissingPhone = schools.filter(s => !s.phone)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <School className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schools</h1>
          <p className="text-gray-500">Manage school details shown to substitutes — address, hours, phone, and website.</p>
        </div>
      </div>

      {!anySchoolHasPhone && (
        <div className="rounded-lg border-2 border-fuchsia-300 bg-fuchsia-50 px-5 py-4 space-y-2">
          <p className="font-bold text-fuchsia-900">Step 4: Add a phone number to your schools</p>
          <p className="text-sm text-fuchsia-700">
            The campus address is already set from onboarding. Each school also needs a <strong>main office phone number</strong> so substitutes know who to call when they arrive.
          </p>
          <p className="text-sm text-fuchsia-700">
            Click <strong>Edit</strong> on any school below, enter the phone number, and click <strong>Save</strong>. Step 4 completes automatically once at least one school has a phone number.
          </p>
          {schoolsMissingPhone.length > 0 && (
            <p className="text-xs text-fuchsia-600 font-medium">
              Missing phone: {schoolsMissingPhone.map(s => s.name).join(', ')}
            </p>
          )}
        </div>
      )}

      <SchoolsClient schools={schools} showPhoneRequired={!anySchoolHasPhone} />
    </div>
  )
}
