import { UserCog } from 'lucide-react'
import { getRosterData } from './actions'
import RosterTabs from './RosterTabs'

export default async function SubRosterPage() {
  const { subs, schools, priorityBySchool } = await getRosterData()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserCog className="h-8 w-8 text-blue-600 flex-shrink-0" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Substitutes</h1>
          <p className="text-gray-500 mt-0.5">
            {subs.filter(s => s.userStatus === 'active').length} active substitutes
          </p>
        </div>
      </div>

      <RosterTabs subs={subs} schools={schools} priorityBySchool={priorityBySchool} />
    </div>
  )
}
