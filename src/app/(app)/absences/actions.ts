/**
 * Server Actions for absence management.
 *
 * "Server Actions" are TypeScript functions that run on the server (not in the browser).
 * They can safely access the database, check who's logged in, and update records.
 *
 * This file handles all the database operations for absences:
 * - Getting the list of employees (teachers) for the Create Absence wizard
 * - Getting absence reasons (Sick Day, Personal Day, etc.)
 * - Creating a new absence record
 * - Approving or denying an absence
 * - Getting absences that need reconciliation
 * - Dashboard stats
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import {
  employees,
  users,
  schools,
  absenceReasons,
  teacherTimeOff,
} from '@/db/schema'
import { eq, and, asc, lt, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

// ─── Auth Helper ─────────────────────────────────────────────────────────────

/**
 * Gets the current logged-in user's organization ID.
 * Every query filters by organization so one school can't see another's data.
 */
async function getOrgAndUserId(): Promise<{ orgId: string; userId: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  })
  if (!profile) throw new Error('User profile not found')

  return { orgId: profile.organizationId, userId: user.id }
}

// ─── Read Queries (used to load data into forms) ─────────────────────────────

/**
 * Returns all active employees (teachers + staff) for the organization.
 * Used in Step 1 of the Create Absence wizard to search and pick a teacher.
 */
export async function getEmployees() {
  const { orgId } = await getOrgAndUserId()

  return db
    .select({
      id: employees.id,
      userId: employees.userId,
      schoolId: employees.schoolId,
      employeeType: employees.employeeType,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      schoolName: schools.name,
      schoolDayStart: schools.dayStartTime,
      schoolDayEnd: schools.dayEndTime,
    })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .innerJoin(schools, eq(employees.schoolId, schools.id))
    .where(
      and(
        eq(users.organizationId, orgId),
        eq(employees.status, 'active'),
      )
    )
    .orderBy(asc(users.lastName), asc(users.firstName))
}

/**
 * Returns all absence reasons for the organization (Sick Day, Personal Day, etc.).
 * Used in Step 2 of the Create Absence wizard.
 */
export async function getAbsenceReasons() {
  const { orgId } = await getOrgAndUserId()

  return db
    .select()
    .from(absenceReasons)
    .where(eq(absenceReasons.organizationId, orgId))
    .orderBy(asc(absenceReasons.sortOrder))
}

/**
 * Returns all absences waiting for approval (approval_status = 'unapproved').
 * Used on the Approve Absences page.
 */
export async function getUnapprovedAbsences() {
  const { orgId } = await getOrgAndUserId()

  return db
    .select({
      id: teacherTimeOff.id,
      date: teacherTimeOff.date,
      startTime: teacherTimeOff.startTime,
      endTime: teacherTimeOff.endTime,
      approvalStatus: teacherTimeOff.approvalStatus,
      substituteRequired: teacherTimeOff.substituteRequired,
      notesToAdmin: teacherTimeOff.notesToAdmin,
      teacherFirstName: users.firstName,
      teacherLastName: users.lastName,
      schoolName: schools.name,
      reasonName: absenceReasons.name,
    })
    .from(teacherTimeOff)
    .innerJoin(employees, eq(teacherTimeOff.employeeId, employees.id))
    .innerJoin(users, eq(employees.userId, users.id))
    .innerJoin(schools, eq(teacherTimeOff.schoolId, schools.id))
    .leftJoin(absenceReasons, eq(teacherTimeOff.reasonId, absenceReasons.id))
    .where(
      and(
        eq(teacherTimeOff.organizationId, orgId),
        eq(teacherTimeOff.approvalStatus, 'unapproved')
      )
    )
    .orderBy(asc(teacherTimeOff.date))
}

/**
 * Returns past approved absences that haven't been reconciled yet.
 * "Reconcile" means confirming the sub actually showed up and worked.
 * Used on the Reconcile Absences page.
 */
export async function getAbsencesForReconcile() {
  const { orgId } = await getOrgAndUserId()
  const today = new Date().toISOString().split('T')[0] // 'YYYY-MM-DD'

  return db
    .select({
      id: teacherTimeOff.id,
      date: teacherTimeOff.date,
      startTime: teacherTimeOff.startTime,
      endTime: teacherTimeOff.endTime,
      substituteRequired: teacherTimeOff.substituteRequired,
      reconciliationStatus: teacherTimeOff.reconciliationStatus,
      notesToAdmin: teacherTimeOff.notesToAdmin,
      teacherFirstName: users.firstName,
      teacherLastName: users.lastName,
      schoolName: schools.name,
      reasonName: absenceReasons.name,
    })
    .from(teacherTimeOff)
    .innerJoin(employees, eq(teacherTimeOff.employeeId, employees.id))
    .innerJoin(users, eq(employees.userId, users.id))
    .innerJoin(schools, eq(teacherTimeOff.schoolId, schools.id))
    .leftJoin(absenceReasons, eq(teacherTimeOff.reasonId, absenceReasons.id))
    .where(
      and(
        eq(teacherTimeOff.organizationId, orgId),
        eq(teacherTimeOff.approvalStatus, 'approved'),
        eq(teacherTimeOff.reconciliationStatus, 'unreconciled'),
        lt(teacherTimeOff.date, today)
      )
    )
    .orderBy(desc(teacherTimeOff.date))
}

/**
 * Returns summary counts for today's absences, used on the dashboard.
 */
export async function getDashboardStats() {
  const { orgId } = await getOrgAndUserId()
  const today = new Date().toISOString().split('T')[0]

  const todayAbsences = await db
    .select({
      approvalStatus: teacherTimeOff.approvalStatus,
      substituteRequired: teacherTimeOff.substituteRequired,
    })
    .from(teacherTimeOff)
    .where(
      and(
        eq(teacherTimeOff.organizationId, orgId),
        eq(teacherTimeOff.date, today)
      )
    )

  return {
    total: todayAbsences.length,
    pending: todayAbsences.filter((a) => a.approvalStatus === 'unapproved').length,
    approved: todayAbsences.filter((a) => a.approvalStatus === 'approved').length,
    noSubNeeded: todayAbsences.filter((a) => !a.substituteRequired).length,
  }
}

// ─── Mutations (write to the database) ───────────────────────────────────────

/**
 * Creates a new absence record.
 * Called when the principal submits the Create Absence wizard.
 * Returns { success: true } or { error: 'message' }.
 */
export async function createAbsence(data: {
  employeeId: string
  schoolId: string
  date: string        // 'YYYY-MM-DD'
  startTime: string   // 'HH:MM'
  endTime: string     // 'HH:MM'
  reasonId: string | null
  notesToAdmin: string
  notesToSub: string
  adminOnlyNotes: string
  substituteRequired: boolean
  holdUntil: string
}) {
  try {
    const { orgId } = await getOrgAndUserId()

    await db.insert(teacherTimeOff).values({
      organizationId: orgId,
      schoolId: data.schoolId,
      employeeId: data.employeeId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      reasonId: data.reasonId || null,
      notesToAdmin: data.notesToAdmin || null,
      notesToSub: data.notesToSub || null,
      adminOnlyNotes: data.adminOnlyNotes || null,
      substituteRequired: data.substituteRequired,
      holdUntil: data.holdUntil || 'no_hold',
    })

    // Tell Next.js to refresh the dashboard and approve page caches
    revalidatePath('/dashboard')
    revalidatePath('/absences/approve')

    return { success: true }
  } catch (error) {
    console.error('Failed to create absence:', error)
    return { error: 'Failed to create absence. Please try again.' }
  }
}

/**
 * Approves a single absence.
 * Called from a form on the Approve Absences page.
 * The `formData` contains the absence ID via a hidden input field.
 */
export async function approveAbsence(formData: FormData) {
  const id = formData.get('id') as string
  const { orgId, userId } = await getOrgAndUserId()

  await db
    .update(teacherTimeOff)
    .set({
      approvalStatus: 'approved',
      approvedBy: userId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(teacherTimeOff.id, id),
        eq(teacherTimeOff.organizationId, orgId)
      )
    )

  revalidatePath('/absences/approve')
  revalidatePath('/dashboard')
}

/**
 * Denies a single absence.
 * Called from a form on the Approve Absences page.
 */
export async function denyAbsence(formData: FormData) {
  const id = formData.get('id') as string
  const { orgId } = await getOrgAndUserId()

  await db
    .update(teacherTimeOff)
    .set({
      approvalStatus: 'denied',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(teacherTimeOff.id, id),
        eq(teacherTimeOff.organizationId, orgId)
      )
    )

  revalidatePath('/absences/approve')
  revalidatePath('/dashboard')
}

/**
 * Marks an absence as reconciled (sub confirmed present).
 * Called from a form on the Reconcile Absences page.
 */
export async function reconcileAbsence(formData: FormData) {
  const id = formData.get('id') as string
  const { orgId } = await getOrgAndUserId()

  await db
    .update(teacherTimeOff)
    .set({
      reconciliationStatus: 'reconciled',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(teacherTimeOff.id, id),
        eq(teacherTimeOff.organizationId, orgId)
      )
    )

  revalidatePath('/absences/reconcile')
  revalidatePath('/dashboard')
}
