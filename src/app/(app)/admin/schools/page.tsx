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

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <School className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schools</h1>
          <p className="text-gray-500">Manage school details shown to substitutes — address, hours, phone, and website.</p>
        </div>
      </div>

      <SchoolsClient schools={schools} />
    </div>
  )
}
