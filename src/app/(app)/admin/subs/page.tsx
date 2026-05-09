import { Users } from 'lucide-react'
import { getPendingJoinRequests, getOrgSchools } from './actions'
import { getSubCounties } from './actions'
import { SubDirectoryClient } from './SubDirectoryClient'
import HireSubsClient from './HireSubsClient'

export default async function AdminSubDirectoryPage() {
  const [pending, orgSchools, counties] = await Promise.all([
    getPendingJoinRequests(),
    getOrgSchools(),
    getSubCounties(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8 text-blue-600 flex-shrink-0" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hire Substitutes</h1>
          <p className="text-gray-500 mt-0.5">Review join requests and browse substitutes in your area.</p>
        </div>
      </div>

      <HireSubsClient pending={pending} orgSchools={orgSchools} />

      {/* Sub directory */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Browse Substitute Directory</h2>
        <p className="text-sm text-gray-500 mb-4">Find substitutes registered in SubHub by county.</p>
        <SubDirectoryClient counties={counties} />
      </div>
    </div>
  )
}
