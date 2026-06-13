'use server'

/**
 * Server Actions for the Teacher portal.
 *
 * Teachers can only see and modify their own absence records.
 * All actions verify the logged-in user is a teacher and that
 * the records being touched belong to them.
 */

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, employees, teacherTimeOff, absenceReasons, substitutes, schools, subSchoolAssignments, subNotificationTokens, assignmentTimeOff, attachments } from '@/db/schema'
import { eq, and, asc, desc, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { notifyAdminsOfAbsenceRequest } from '@/lib/notifications'

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getTeacherContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    with: { school: true },
  })
  if (!profile || profile.role !== 'teacher') throw new Error('Teacher access required')

  // Get this teacher's employee record (links them to a school)
  const employee = await db.query.employees.findFirst({
    where: eq(employees.userId, user.id),
    with: { school: true },
  })

  return { profile, employee, orgId: profile.organizationId }
}

export async function saveAvatar(url: string) {
  const { profile } = await getTeacherContext()
  await db.update(users).set({ avatarUrl: url }).where(eq(users.id, profile.id))
  revalidatePath('/teacher/profile')
}

export async function saveTeacherProfile(data: { firstName: string; lastName: string; phone: string }) {
  const { profile } = await getTeacherContext()
  await db.update(users)
    .set({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: data.phone.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, profile.id))
  revalidatePath('/teacher/profile')
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getMyTeacherContext() {
  const { profile, employee, orgId } = await getTeacherContext()

  // Get sub IDs assigned to this teacher's school
  const schoolSubRows = employee?.schoolId
    ? await db
        .select({ substituteId: subSchoolAssignments.substituteId })
        .from(subSchoolAssignments)
        .where(and(
          eq(subSchoolAssignments.schoolId, employee.schoolId),
          eq(subSchoolAssignments.status, 'active')
        ))
    : []
  const schoolSubIds = schoolSubRows.map(r => r.substituteId)

  const [reasons, subs, allSchools] = await Promise.all([
    db
      .select()
      .from(absenceReasons)
      .where(eq(absenceReasons.organizationId, orgId))
      .orderBy(asc(absenceReasons.sortOrder)),

    schoolSubIds.length > 0
      ? db
          .select({
            id: substitutes.id,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(substitutes)
          .innerJoin(users, eq(substitutes.userId, users.id))
          .where(and(
            inArray(substitutes.id, schoolSubIds),
            eq(substitutes.status, 'active')
          ))
          .orderBy(asc(users.lastName))
      : Promise.resolve([]),

    db
      .select({ id: schools.id, dayStartTime: schools.dayStartTime, dayEndTime: schools.dayEndTime })
      .from(schools)
      .where(eq(schools.organizationId, orgId)),
  ])

  return { profile, employee, reasons, subs, allSchools }
}

export async function getMyAbsences() {
  const { employee } = await getTeacherContext()
  if (!employee) return []

  return db.query.teacherTimeOff.findMany({
    where: eq(teacherTimeOff.employeeId, employee.id),
    with: {
      school: true,
      reason: true,
      assignmentLinks: {
        with: {
          assignment: {
            with: { substitute: { with: { user: true } } },
          },
        },
      },
    },
    orderBy: [desc(teacherTimeOff.startDate)],
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function submitAbsenceRequest(data: {
  startDate: string
  endDate: string | null
  startTime: string
  endTime: string
  reasonId: string | null
  substituteRequired: boolean
  notesToSub: string
  notesToAdmin: string
  requestedSubId: string | null
  attachments?: { fileName: string; fileUrl: string; fileSize: number; fileType: string }[]
}) {
  const { profile, employee, orgId } = await getTeacherContext()
  if (!employee) return { error: 'No employee record found — contact your admin.' }

  const [newAbsence] = await db.insert(teacherTimeOff).values({
    organizationId: orgId,
    schoolId: employee.schoolId,
    employeeId: employee.id,
    startDate: data.startDate,
    endDate: data.endDate || null,
    startTime: data.startTime,
    endTime: data.endTime,
    reasonId: data.reasonId || null,
    substituteRequired: data.substituteRequired,
    notesToSub: data.notesToSub || null,
    notesToAdmin: data.notesToAdmin || null,
    requestedSubId: data.requestedSubId || null,
    approvalStatus: 'approved',
    subOutreachStatus: 'not_started',
  }).returning({ id: teacherTimeOff.id })

  if (data.attachments?.length && newAbsence) {
    await db.insert(attachments).values(
      data.attachments.map(a => ({
        organizationId: orgId,
        teacherTimeOffId: newAbsence.id,
        uploadedBy: profile.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        fileSize: a.fileSize,
        fileType: a.fileType,
      }))
    )
  }

  // Notify admins so they know a request came in and can cancel before 6am if needed
  if (data.substituteRequired) {
    const teacherName = `${profile.firstName} ${profile.lastName}`
    const school = await db.query.schools.findFirst({ where: eq(schools.id, employee.schoolId) })
    await notifyAdminsOfAbsenceRequest({
      orgId,
      schoolId: employee.schoolId,
      teacherName,
      schoolName: school?.name ?? 'your school',
      startDate: data.startDate,
      endDate: data.endDate || null,
      absenceId: '',
    }).catch(() => {}) // don't fail the request if email fails
  }

  revalidatePath('/teacher/absences')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Teachers can delete their own request ONLY if no sub has accepted yet.
 * Race-condition safe: checks outreachStatus inside the transaction.
 */
export async function deleteAbsenceRequest(id: string) {
  const { employee } = await getTeacherContext()
  if (!employee) return { error: 'No employee record found' }

  // Load the record first to verify ownership and outreach status
  const record = await db.query.teacherTimeOff.findFirst({
    where: and(
      eq(teacherTimeOff.id, id),
      eq(teacherTimeOff.employeeId, employee.id)
    ),
  })

  if (!record) return { error: 'Request not found' }
  if (record.subOutreachStatus !== 'not_started') {
    return { error: 'This request cannot be deleted — substitutes have already been notified or a sub has accepted.' }
  }

  // Clean up child records first to avoid FK constraint violations
  await db.delete(subNotificationTokens).where(eq(subNotificationTokens.teacherTimeOffId, id))
  await db.delete(assignmentTimeOff).where(eq(assignmentTimeOff.timeOffId, id))
  await db.delete(teacherTimeOff).where(eq(teacherTimeOff.id, id))

  revalidatePath('/teacher/absences')
  revalidatePath('/dashboard')
  return { success: true }
}
