/**
 * Submit Absence Request — teacher's simplified absence form.
 * Single page (vs the 4-step admin wizard). Teachers only submit for themselves.
 */

import { getMyTeacherContext } from '../../../actions'
import TeacherAbsenceForm from './TeacherAbsenceForm'
import { db } from '@/db'
import { organizations } from '@/db/schema'
import { eq } from 'drizzle-orm'

export default async function NewAbsencePage() {
  const { employee, reasons, subs, allSchools, profile } = await getMyTeacherContext()
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, profile.organizationId) })
  const timezone = org?.timezone ?? 'America/Los_Angeles'

  const schoolDayStart = allSchools.find(s => s.id === employee?.schoolId)?.dayStartTime ?? '07:30'
  const schoolDayEnd = allSchools.find(s => s.id === employee?.schoolId)?.dayEndTime ?? '15:30'

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Submit Absence Request</h1>
        <p className="text-gray-500 mt-1">Fill out the details below. Your admin will review and approve.</p>
      </div>

      {!employee ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700 text-sm">
          Your account is not linked to a school yet. Please contact your administrator.
        </div>
      ) : (
        <TeacherAbsenceForm
          reasons={reasons}
          subs={subs}
          schoolDayStart={schoolDayStart ?? '07:30'}
          schoolDayEnd={schoolDayEnd ?? '15:30'}
          timezone={timezone}
        />
      )}
    </div>
  )
}
