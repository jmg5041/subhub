import { db } from '@/db'
import { absenceReasons } from '@/db/schema'

// Default absence reasons seeded for every new organization
export const DEFAULT_ABSENCE_REASONS = [
  { name: 'Illness',                      isDefault: true,  sortOrder: 1 },
  { name: 'Personal Day',                 isDefault: false, sortOrder: 2 },
  { name: 'Bereavement / Family Emergency', isDefault: false, sortOrder: 3 },
  { name: 'Coaching or Athletic Duty',    isDefault: false, sortOrder: 4 },
  { name: 'Field Trip',                   isDefault: false, sortOrder: 5 },
  { name: 'Extended Leave',               isDefault: false, sortOrder: 6 },
  { name: 'Professional Development',     isDefault: false, sortOrder: 7 },
  { name: 'Unpaid Absence',               isDefault: false, sortOrder: 8 },
]

export async function seedDefaultAbsenceReasons(orgId: string) {
  await db.insert(absenceReasons).values(
    DEFAULT_ABSENCE_REASONS.map(r => ({ ...r, organizationId: orgId }))
  )
}
