import { db } from '@/db'
import { absenceReasons } from '@/db/schema'

// Default absence reasons seeded for every new organization
export const DEFAULT_ABSENCE_REASONS = [
  { name: 'Sick Day',                isDefault: true,  sortOrder: 1 },
  { name: 'Personal Day',            isDefault: false, sortOrder: 2 },
  { name: 'Bereavement',             isDefault: false, sortOrder: 3 },
  { name: 'Coaching Duties',         isDefault: false, sortOrder: 4 },
  { name: 'Field Trip Coverage',     isDefault: false, sortOrder: 5 },
  { name: 'Leave of Absence',        isDefault: false, sortOrder: 6 },
  { name: 'Professional Development',isDefault: false, sortOrder: 7 },
  { name: 'Unpaid Absence',          isDefault: false, sortOrder: 8 },
  { name: 'Unpaid Vacation',         isDefault: false, sortOrder: 9 },
]

export async function seedDefaultAbsenceReasons(orgId: string) {
  await db.insert(absenceReasons).values(
    DEFAULT_ABSENCE_REASONS.map(r => ({ ...r, organizationId: orgId }))
  )
}
