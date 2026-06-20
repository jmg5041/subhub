import { ClipboardList } from 'lucide-react'
import { getAbsencesForReconcile } from '../actions'
import ReconcileClient from './ReconcileClient'

export default async function ReconcileAbsencesPage() {
  const absences = await getAbsencesForReconcile()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-8 w-8 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reconcile Absences</h1>
            <p className="text-gray-500">Confirm past absences and verify substitute attendance</p>
          </div>
        </div>
        {absences.length > 0 && (
          <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
            {absences.length} to reconcile
          </span>
        )}
      </div>

      <ReconcileClient absences={absences} />
    </div>
  )
}
