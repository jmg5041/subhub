'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, substitutes, subPriorityOrders, schools, subSchoolAssignments } from '@/db/schema'
import { eq, asc, and, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getEffectiveOrgId } from '@/lib/impersonation'

async function getOrgId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const orgId = await getEffectiveOrgId(user.id)
  if (!orgId) throw new Error('User profile not found')
  return orgId
}

export async function getRosterData() {
  const orgId = await getOrgId()

  const [allSubs, orgSchools, allPriorityRows, schoolAssignments] = await Promise.all([
    db
      .select({
        id: substitutes.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        county: substitutes.county,
        rating: substitutes.rating,
        ratingCount: substitutes.ratingCount,
        resumeUrl: substitutes.resumeUrl,
        avatarUrl: users.avatarUrl,
        userStatus: users.status,
      })
      .from(substitutes)
      .innerJoin(users, eq(substitutes.userId, users.id))
      .where(eq(users.organizationId, orgId))
      .orderBy(asc(users.lastName), asc(users.firstName)),

    db
      .select({ id: schools.id, name: schools.name })
      .from(schools)
      .where(eq(schools.organizationId, orgId))
      .orderBy(asc(schools.name)),

    db
      .select()
      .from(subPriorityOrders)
      .where(eq(subPriorityOrders.organizationId, orgId))
      .orderBy(asc(subPriorityOrders.priorityRank)),

    db
      .select({
        substituteId: subSchoolAssignments.substituteId,
        schoolId: subSchoolAssignments.schoolId,
        schoolName: schools.name,
        status: subSchoolAssignments.status,
      })
      .from(subSchoolAssignments)
      .innerJoin(schools, eq(subSchoolAssignments.schoolId, schools.id))
      .where(and(eq(subSchoolAssignments.organizationId, orgId), eq(subSchoolAssignments.status, 'active'))),
  ])

  // Build a map: schoolId → ordered sub IDs
  const priorityBySchool: Record<string, string[]> = {}
  for (const row of allPriorityRows) {
    const key = row.schoolId ?? '__org__'
    if (!priorityBySchool[key]) priorityBySchool[key] = []
    priorityBySchool[key].push(row.substituteId)
  }

  // Build a map: substituteId → school names[]
  const subSchools: Record<string, { id: string; name: string }[]> = {}
  for (const row of schoolAssignments) {
    if (!subSchools[row.substituteId]) subSchools[row.substituteId] = []
    subSchools[row.substituteId].push({ id: row.schoolId, name: row.schoolName })
  }

  // Build a map: schoolId → active sub IDs (for filtering priority lists)
  const activeSubsBySchool: Record<string, string[]> = {}
  for (const row of schoolAssignments) {
    if (!activeSubsBySchool[row.schoolId]) activeSubsBySchool[row.schoolId] = []
    activeSubsBySchool[row.schoolId].push(row.substituteId)
  }

  return { subs: allSubs, schools: orgSchools, priorityBySchool, subSchools, activeSubsBySchool, orgId }
}

export async function saveSchoolPriorityOrder(orderedSubIds: string[], schoolId: string) {
  const orgId = await getOrgId()

  await db
    .delete(subPriorityOrders)
    .where(
      and(
        eq(subPriorityOrders.organizationId, orgId),
        eq(subPriorityOrders.schoolId, schoolId)
      )
    )

  if (orderedSubIds.length > 0) {
    await db.insert(subPriorityOrders).values(
      orderedSubIds.map((substituteId, index) => ({
        organizationId: orgId,
        schoolId,
        substituteId,
        priorityRank: index + 1,
      }))
    )
  }

  revalidatePath('/admin/subs/roster')
  return { success: true }
}

export async function getSubDetailData(subId: string) {
  const orgId = await getOrgId()

  const [orgSchools, currentAssignments] = await Promise.all([
    db
      .select({ id: schools.id, name: schools.name })
      .from(schools)
      .where(eq(schools.organizationId, orgId))
      .orderBy(asc(schools.name)),

    db
      .select({ schoolId: subSchoolAssignments.schoolId, status: subSchoolAssignments.status })
      .from(subSchoolAssignments)
      .where(
        and(
          eq(subSchoolAssignments.substituteId, subId),
          eq(subSchoolAssignments.organizationId, orgId)
        )
      ),
  ])

  return { orgSchools, currentAssignments }
}

export async function setSubSchoolAssignments(subId: string, schoolIds: string[]) {
  const orgId = await getOrgId()

  await db
    .delete(subSchoolAssignments)
    .where(
      and(
        eq(subSchoolAssignments.substituteId, subId),
        eq(subSchoolAssignments.organizationId, orgId)
      )
    )

  if (schoolIds.length > 0) {
    await db.insert(subSchoolAssignments).values(
      schoolIds.map(schoolId => ({
        substituteId: subId,
        schoolId,
        organizationId: orgId,
        status: 'active' as const,
      }))
    )
  }

  revalidatePath('/admin/subs/roster')
  revalidatePath(`/admin/subs/roster/${subId}`)
  return { success: true }
}
