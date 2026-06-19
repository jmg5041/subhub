'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, substitutes, subSchoolAssignments, schools } from '@/db/schema'
import { eq, asc, sql, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getEffectiveOrgId } from '@/lib/impersonation'

async function getAdminOrgContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile || (!['admin', 'principal', 'staff'].includes(profile.role) && !profile.isPlatformAdmin)) {
    throw new Error('Admin access required')
  }
  const orgId = await getEffectiveOrgId(user.id)
  if (!orgId) throw new Error('Org not found')
  return { orgId, userId: user.id }
}

export async function getOrgSubUserIds(): Promise<string[]> {
  const { orgId } = await getAdminOrgContext()
  const rows = await db
    .select({ userId: substitutes.userId })
    .from(substitutes)
    .innerJoin(users, eq(substitutes.userId, users.id))
    .where(eq(users.organizationId, orgId))
  return rows.map(r => r.userId)
}

export async function getSubCounties() {
  const rows = await db
    .selectDistinct({ county: substitutes.county })
    .from(substitutes)
    .where(sql`${substitutes.county} IS NOT NULL`)
    .orderBy(asc(substitutes.county))
  return rows.map(r => r.county as string)
}

export async function getSubsByCounty(county: string | null) {
  await getAdminOrgContext()
  const rows = await db.query.substitutes.findMany({
    where: county
      ? and(eq(substitutes.county, county), eq(substitutes.visibleInDirectory, true))
      : eq(substitutes.visibleInDirectory, true),
    columns: { id: true, county: true, rating: true, ratingCount: true, resumeUrl: true, status: true },
    with: { user: { columns: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
    orderBy: (s, { asc }) => [asc(s.id)],
  })
  return rows
    .filter(s => s.status === 'active')
    .sort((a, b) => a.user.lastName.localeCompare(b.user.lastName))
}

export async function getPendingJoinRequests() {
  const { orgId } = await getAdminOrgContext()
  return db
    .select({
      id: subSchoolAssignments.id,
      status: subSchoolAssignments.status,
      requestedAt: subSchoolAssignments.requestedAt,
      substituteId: subSchoolAssignments.substituteId,
      schoolId: subSchoolAssignments.schoolId,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      schoolName: schools.name,
    })
    .from(subSchoolAssignments)
    .innerJoin(substitutes, eq(subSchoolAssignments.substituteId, substitutes.id))
    .innerJoin(users, eq(substitutes.userId, users.id))
    .innerJoin(schools, eq(subSchoolAssignments.schoolId, schools.id))
    .where(and(eq(subSchoolAssignments.organizationId, orgId), eq(subSchoolAssignments.status, 'pending')))
}

export async function approveSubForSchool(assignmentId: string, additionalSchoolIds: string[]) {
  const { userId, orgId } = await getAdminOrgContext()

  await db
    .update(subSchoolAssignments)
    .set({ status: 'active', reviewedAt: new Date(), reviewedBy: userId })
    .where(eq(subSchoolAssignments.id, assignmentId))

  const [assignment] = await db
    .select({ substituteId: subSchoolAssignments.substituteId })
    .from(subSchoolAssignments)
    .where(eq(subSchoolAssignments.id, assignmentId))

  if (assignment && additionalSchoolIds.length > 0) {
    for (const schoolId of additionalSchoolIds) {
      await db
        .insert(subSchoolAssignments)
        .values({ substituteId: assignment.substituteId, schoolId, organizationId: orgId, status: 'active', reviewedAt: new Date(), reviewedBy: userId })
        .onConflictDoUpdate({
          target: [subSchoolAssignments.substituteId, subSchoolAssignments.schoolId],
          set: { status: 'active', reviewedAt: new Date(), reviewedBy: userId },
        })
    }
  }

  revalidatePath('/admin/subs')
  revalidatePath('/admin/subs/roster')
}

export async function rejectSubRequest(assignmentId: string) {
  const { userId } = await getAdminOrgContext()
  await db
    .update(subSchoolAssignments)
    .set({ status: 'rejected', reviewedAt: new Date(), reviewedBy: userId })
    .where(eq(subSchoolAssignments.id, assignmentId))
  revalidatePath('/admin/subs')
}

export async function getOrgSchools() {
  const { orgId } = await getAdminOrgContext()
  return db.select({ id: schools.id, name: schools.name }).from(schools).where(eq(schools.organizationId, orgId))
}
