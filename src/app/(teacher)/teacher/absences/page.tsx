/**
 * My Absences — teacher's full absence history.
 * Teachers can delete requests that haven't been filled yet.
 */

import { getMyAbsences } from '../../actions'
import MyAbsencesClient from './MyAbsencesClient'

export default async function MyAbsencesPage() {
  const absences = await getMyAbsences()
  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Absences</h1>
        <p className="text-gray-500 mt-1">All your absence requests. You can delete a request until a substitute has been notified.</p>
      </div>
      <MyAbsencesClient absences={absences} />
    </div>
  )
}
