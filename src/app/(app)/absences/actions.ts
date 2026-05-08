/**
 * Server Actions for absence management.
 *
 * "Server Actions" are TypeScript functions that run on the server (not in the browser).
 * They can safely access the database, check who's logged in, and update records.
 *
 * This file handles all the database operations for absences:
 * - Getting employees and absence reasons (for the Create Absence wizard)
 * - Creating a new absence record (with optional file attachments)
 * - Approving, denying, or unapproving an absence
 * - Editing notes for sub and managing attachments on existing absences
 * - Getting absences for reconciliation and dashboard stats
 * - Finding and assigning substitutes (direct assign or blast notification)
 * - Cancelling a sub assignment
 * - Toggling staff coverage
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
  attachments,
  substitutes,
  subAssignments,
  assignmentTimeOff,
  subPriorityOrders,
} from '@/db/schema'
import { eq, and, asc, lt, lte, gte, desc, or, isNull, sql, ne } from 'drizzle-orm'
import { countWeekdays } from '@/lib/date-utils'
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

/** Exported wrapper so server pages can get org/user context for passing to client components. */
export async function getUserContext() {
  return getOrgAndUserId()
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
      startDate: teacherTimeOff.startDate,
      endDate: teacherTimeOff.endDate,
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
    .orderBy(asc(teacherTimeOff.startDate))
}

/**
 * Returns past approved absences that haven't been reconciled yet.
 * "Reconcile" means confirming the sub actually showed up and worked.
 * Used on the Reconcile Absences page.
 */
export async function getApprovedUnfilledAbsences() {
  const { orgId } = await getOrgAndUserId()

  return db
    .select({
      id: teacherTimeOff.id,
      startDate: teacherTimeOff.startDate,
      endDate: teacherTimeOff.endDate,
      startTime: teacherTimeOff.startTime,
      endTime: teacherTimeOff.endTime,
      subOutreachStatus: teacherTimeOff.subOutreachStatus,
      substituteRequired: teacherTimeOff.substituteRequired,
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
        eq(teacherTimeOff.substituteRequired, true),
        ne(teacherTimeOff.subOutreachStatus, 'filled')
      )
    )
    .orderBy(asc(teacherTimeOff.startDate))
}

export async function getAbsencesForReconcile() {
  const { orgId } = await getOrgAndUserId()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) // 'YYYY-MM-DD'

  return db
    .select({
      id: teacherTimeOff.id,
      startDate: teacherTimeOff.startDate,
      endDate: teacherTimeOff.endDate,
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
        // Absence is fully in the past: last day (endDate if set, else startDate) < today
        sql`COALESCE(${teacherTimeOff.endDate}, ${teacherTimeOff.startDate}) < ${today}`
      )
    )
    .orderBy(desc(teacherTimeOff.startDate))
}

/**
 * Returns summary counts for today's absences, used on the dashboard.
 */
export async function getDashboardStats() {
  const { orgId } = await getOrgAndUserId()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

  const todayAbsences = await db
    .select({
      approvalStatus: teacherTimeOff.approvalStatus,
      substituteRequired: teacherTimeOff.substituteRequired,
    })
    .from(teacherTimeOff)
    .where(
      and(
        eq(teacherTimeOff.organizationId, orgId),
        // Absence covers today: startDate <= today AND (endDate IS NULL OR endDate >= today)
        lte(teacherTimeOff.startDate, today),
        or(isNull(teacherTimeOff.endDate), gte(teacherTimeOff.endDate, today))
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
type AttachmentInput = {
  fileName: string
  fileUrl: string
  fileSize: number
  fileType: string
}

export async function createAbsence(data: {
  employeeId: string
  schoolId: string
  startDate: string       // 'YYYY-MM-DD'
  endDate: string | null  // 'YYYY-MM-DD', null = single day
  startTime: string       // 'HH:MM'
  endTime: string         // 'HH:MM'
  reasonId: string | null
  notesToAdmin: string
  notesToSub: string
  adminOnlyNotes: string
  substituteRequired: boolean
  holdUntil: string
  attachments?: AttachmentInput[]
}) {
  try {
    const { orgId, userId } = await getOrgAndUserId()

    const [newAbsence] = await db.insert(teacherTimeOff).values({
      organizationId: orgId,
      schoolId: data.schoolId,
      employeeId: data.employeeId,
      startDate: data.startDate,
      endDate: data.endDate || null,
      startTime: data.startTime,
      endTime: data.endTime,
      reasonId: data.reasonId || null,
      notesToAdmin: data.notesToAdmin || null,
      notesToSub: data.notesToSub || null,
      adminOnlyNotes: data.adminOnlyNotes || null,
      substituteRequired: data.substituteRequired,
      holdUntil: data.holdUntil || 'no_hold',
    }).returning({ id: teacherTimeOff.id })

    if (data.attachments?.length && newAbsence) {
      await db.insert(attachments).values(
        data.attachments.map(a => ({
          organizationId: orgId,
          teacherTimeOffId: newAbsence.id,
          uploadedBy: userId,
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileSize: a.fileSize,
          fileType: a.fileType,
        }))
      )
    }

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

// ─── Find Sub actions ─────────────────────────────────────────────────────────

/**
 * Loads full details for one absence, used on the Find Sub page.
 * Includes teacher name, school, reason, and any existing sub assignment.
 */
export async function getAbsenceWithDetails(id: string) {
  const { orgId } = await getOrgAndUserId()

  return db.query.teacherTimeOff.findFirst({
    where: and(
      eq(teacherTimeOff.id, id),
      eq(teacherTimeOff.organizationId, orgId)
    ),
    with: {
      employee: {
        with: { user: true },
      },
      school: true,
      reason: true,
      requestedSub: {
        with: { user: true },
      },
      assignmentLinks: {
        with: {
          assignment: {
            with: {
              substitute: {
                with: { user: true },
              },
            },
          },
        },
      },
      attachments: true,
    },
  })
}

/**
 * Returns active subs for the org eligible for a given school, sorted by priority rank.
 * Filters out subs whose excludedFromSchools list includes the target school.
 */
export async function getAvailableSubs(schoolId?: string | null) {
  const { orgId } = await getOrgAndUserId()

  const priorityRows = await db
    .select()
    .from(subPriorityOrders)
    .where(eq(subPriorityOrders.organizationId, orgId))
    .orderBy(asc(subPriorityOrders.priorityRank))

  const rankMap = new Map(priorityRows.map(r => [r.substituteId, r.priorityRank]))

  const allSubs = await db
    .select({
      id: substitutes.id,
      userId: substitutes.userId,
      status: substitutes.status,
      preferredAtSchools: substitutes.preferredAtSchools,
      excludedFromSchools: substitutes.excludedFromSchools,
      notificationPreference: substitutes.notificationPreference,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
    })
    .from(substitutes)
    .innerJoin(users, eq(substitutes.userId, users.id))
    .where(
      and(
        eq(users.organizationId, orgId),
        eq(substitutes.status, 'active')
      )
    )
    .orderBy(asc(users.lastName), asc(users.firstName))

  // Filter out subs excluded from this school
  const eligible = schoolId
    ? allSubs.filter(s => {
        const excluded = (s.excludedFromSchools as string[] | null) ?? []
        return !excluded.includes(schoolId)
      })
    : allSubs

  return eligible
    .map(s => ({ ...s, priorityRank: rankMap.get(s.id) ?? 999 }))
    .sort((a, b) => a.priorityRank - b.priorityRank || a.lastName.localeCompare(b.lastName))
}

/**
 * Admin assigns a specific sub directly — no notification sent.
 * Creates the sub_assignment and assignment_time_off rows, marks absence as filled.
 */
export async function assignSubDirectly(formData: FormData) {
  const timeOffId = formData.get('timeOffId') as string
  const substituteId = formData.get('substituteId') as string

  const { orgId } = await getOrgAndUserId()

  // Load the absence to get date/time/school
  const absence = await db.query.teacherTimeOff.findFirst({
    where: and(
      eq(teacherTimeOff.id, timeOffId),
      eq(teacherTimeOff.organizationId, orgId)
    ),
  })
  if (!absence) throw new Error('Absence not found')

  // Compute total hours (daily hours × number of school days)
  const [sh, sm] = absence.startTime.split(':').map(Number)
  const [eh, em] = absence.endTime.split(':').map(Number)
  const dailyHours = ((eh * 60 + em) - (sh * 60 + sm)) / 60
  const totalHours = dailyHours * countWeekdays(absence.startDate, absence.endDate)

  // Create the sub assignment
  const [assignment] = await db
    .insert(subAssignments)
    .values({
      organizationId: orgId,
      schoolId: absence.schoolId,
      substituteId,
      date: absence.startDate,
      startTime: absence.startTime,
      endTime: absence.endTime,
      totalHours: totalHours.toFixed(2),
      status: 'assigned',
      assignedByAdmin: true,
    })
    .returning()

  // Link the assignment to this absence
  await db.insert(assignmentTimeOff).values({
    assignmentId: assignment.id,
    timeOffId,
  })

  // Mark absence as filled and auto-approve (admin assigning directly = implicit approval)
  await db
    .update(teacherTimeOff)
    .set({ subOutreachStatus: 'filled', approvalStatus: 'approved', updatedAt: new Date() })
    .where(eq(teacherTimeOff.id, timeOffId))

  revalidatePath('/dashboard')
  revalidatePath('/absences/find-sub')
  revalidatePath(`/absences/find-sub/${timeOffId}`)
  return { success: true }
}

/**
 * Cancels a sub assignment — removes the assignment rows and resets the absence
 * back to 'not_started' so the admin can reassign or blast to all subs.
 */
export async function cancelSubAssignment(timeOffId: string) {
  const { orgId } = await getOrgAndUserId()

  const absence = await db.query.teacherTimeOff.findFirst({
    where: and(eq(teacherTimeOff.id, timeOffId), eq(teacherTimeOff.organizationId, orgId)),
  })
  if (!absence) return { error: 'Absence not found' }

  // Find all assignment links for this absence
  const links = await db.query.assignmentTimeOff.findMany({
    where: eq(assignmentTimeOff.timeOffId, timeOffId),
  })
  const assignmentIds = links.map(l => l.assignmentId)

  // Delete links first (FK references subAssignments), then the assignments
  await db.delete(assignmentTimeOff).where(eq(assignmentTimeOff.timeOffId, timeOffId))
  for (const assignmentId of assignmentIds) {
    await db.delete(subAssignments).where(eq(subAssignments.id, assignmentId))
  }

  // Reset absence back to needing a sub
  await db
    .update(teacherTimeOff)
    .set({ subOutreachStatus: 'not_started', updatedAt: new Date() })
    .where(eq(teacherTimeOff.id, timeOffId))

  revalidatePath('/absences/find-sub')
  revalidatePath(`/absences/find-sub/${timeOffId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Updates the date range on an existing absence.
 * Blocked once a substitute has accepted (subOutreachStatus = 'filled').
 */
export async function updateAbsenceDates(
  timeOffId: string,
  startDate: string,
  endDate: string | null
) {
  const { orgId } = await getOrgAndUserId()

  const absence = await db.query.teacherTimeOff.findFirst({
    where: and(eq(teacherTimeOff.id, timeOffId), eq(teacherTimeOff.organizationId, orgId)),
  })
  if (!absence) return { error: 'Absence not found' }
  if (absence.subOutreachStatus === 'filled') {
    return { error: 'Cannot change dates — a substitute is already assigned.' }
  }

  await db
    .update(teacherTimeOff)
    .set({ startDate, endDate: endDate || null, updatedAt: new Date() })
    .where(eq(teacherTimeOff.id, timeOffId))

  revalidatePath(`/absences/find-sub/${timeOffId}`)
  revalidatePath('/dashboard')
  revalidatePath('/absences/approve')
  return { success: true }
}

/**
 * Updates the "notes for sub" field on an existing absence.
 * Called when admin clicks Save after editing notes on the Absence Details page.
 */
export async function updateNotesToSub(timeOffId: string, notes: string) {
  const { orgId } = await getOrgAndUserId()

  await db
    .update(teacherTimeOff)
    .set({ notesToSub: notes.trim() || null, updatedAt: new Date() })
    .where(
      and(
        eq(teacherTimeOff.id, timeOffId),
        eq(teacherTimeOff.organizationId, orgId)
      )
    )

  revalidatePath(`/absences/find-sub/${timeOffId}`)
  return { success: true }
}

/**
 * Saves a new attachment row for an already-created absence.
 * The file has already been uploaded to Supabase Storage by the browser;
 * this just records the metadata in the database.
 */
export async function saveAbsenceAttachment(
  timeOffId: string,
  attachment: { fileName: string; fileUrl: string; fileSize: number; fileType: string }
) {
  const { orgId, userId } = await getOrgAndUserId()

  const absence = await db.query.teacherTimeOff.findFirst({
    where: and(
      eq(teacherTimeOff.id, timeOffId),
      eq(teacherTimeOff.organizationId, orgId)
    ),
  })
  if (!absence) return { error: 'Absence not found' }

  const [newAttachment] = await db
    .insert(attachments)
    .values({
      organizationId: orgId,
      teacherTimeOffId: timeOffId,
      uploadedBy: userId,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      fileSize: attachment.fileSize,
      fileType: attachment.fileType,
    })
    .returning()

  return { success: true, attachment: newAttachment }
}

/**
 * Deletes an attachment record from the database.
 * The file remains in Supabase Storage (orphaned storage files are cleaned up manually).
 */
export async function deleteAttachment(attachmentId: string) {
  const { orgId } = await getOrgAndUserId()

  const attachment = await db.query.attachments.findFirst({
    where: and(
      eq(attachments.id, attachmentId),
      eq(attachments.organizationId, orgId)
    ),
  })
  if (!attachment) return { error: 'Attachment not found' }

  await db.delete(attachments).where(eq(attachments.id, attachmentId))
  return { success: true }
}

/**
 * Reverts an approved absence back to "unapproved" so the admin can reconsider.
 * Blocked if a substitute has already been assigned (subOutreachStatus = 'filled').
 */
export async function unapproveAbsence(timeOffId: string) {
  const { orgId } = await getOrgAndUserId()

  const absence = await db.query.teacherTimeOff.findFirst({
    where: and(
      eq(teacherTimeOff.id, timeOffId),
      eq(teacherTimeOff.organizationId, orgId)
    ),
  })

  if (!absence) return { error: 'Absence not found' }
  if (absence.subOutreachStatus === 'filled') {
    return { error: 'Cannot cancel — a substitute is already assigned. Cancel the sub assignment first.' }
  }

  await db
    .update(teacherTimeOff)
    .set({ approvalStatus: 'unapproved', approvedBy: null, approvedAt: null, updatedAt: new Date() })
    .where(eq(teacherTimeOff.id, timeOffId))

  revalidatePath('/dashboard')
  revalidatePath(`/absences/find-sub/${timeOffId}`)
  revalidatePath('/absences/approve')
  return { success: true }
}

/**
 * Triggers the notification blast — emails all available subs with accept/decline links.
 * First sub to accept gets the position.
 */
export async function notifyAllSubsAction(timeOffId: string) {
  const { orgId } = await getOrgAndUserId()

  // Verify this absence belongs to the admin's org
  const absence = await db.query.teacherTimeOff.findFirst({
    where: and(
      eq(teacherTimeOff.id, timeOffId),
      eq(teacherTimeOff.organizationId, orgId)
    ),
  })
  if (!absence) throw new Error('Absence not found')

  const { notifyAllSubs } = await import('@/lib/notifications')
  const result = await notifyAllSubs(timeOffId)

  revalidatePath('/dashboard')
  revalidatePath(`/absences/find-sub/${timeOffId}`)

  return result
}

/**
 * Toggles staff coverage on an absence.
 * coveredByStaff=true  → substituteRequired=false, marked approved
 * coveredByStaff=false → substituteRequired=true, back to not_started
 */
export async function toggleStaffCoverage(timeOffId: string, coveredByStaff: boolean) {
  const { orgId } = await getOrgAndUserId()
  const absence = await db.query.teacherTimeOff.findFirst({
    where: and(eq(teacherTimeOff.id, timeOffId), eq(teacherTimeOff.organizationId, orgId)),
  })
  if (!absence) return { error: 'Absence not found' }

  await db
    .update(teacherTimeOff)
    .set({
      substituteRequired: !coveredByStaff,
      approvalStatus: 'approved',
      subOutreachStatus: 'not_started',
      updatedAt: new Date(),
    })
    .where(eq(teacherTimeOff.id, timeOffId))

  revalidatePath('/dashboard')
  revalidatePath(`/absences/find-sub/${timeOffId}`)
  return { success: true }
}

export async function updateStaffCoverageNotes(timeOffId: string, notes: string) {
  const { orgId } = await getOrgAndUserId()

  await db
    .update(teacherTimeOff)
    .set({ staffCoverageNotes: notes.trim() || null, updatedAt: new Date() })
    .where(
      and(
        eq(teacherTimeOff.id, timeOffId),
        eq(teacherTimeOff.organizationId, orgId)
      )
    )

  revalidatePath(`/absences/find-sub/${timeOffId}`)
  return { success: true }
}
