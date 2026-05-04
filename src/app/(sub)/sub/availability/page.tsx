/**
 * Sub availability calendar — subs mark dates they cannot work.
 * The notification blast skips subs who are marked unavailable on the absence date.
 */

import { getMyUnavailableDates } from '../../actions'
import AvailabilityCalendar from './AvailabilityCalendar'

export default async function AvailabilityPage() {
  const today = new Date()
  const unavailableDates = await getMyUnavailableDates(today.getFullYear(), today.getMonth() + 1)

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Availability</h1>
        <p className="text-gray-500 mt-1">
          Click any date to mark it unavailable. You won&apos;t receive job notifications on those days.
        </p>
      </div>
      <AvailabilityCalendar initialUnavailableDates={unavailableDates} />
    </div>
  )
}
