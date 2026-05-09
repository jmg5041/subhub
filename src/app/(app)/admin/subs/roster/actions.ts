'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, substitutes, subPriorityOrders, schools } from '@/db/schema'
import { eq, asc, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

async function getOrgId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile) throw new Error('User profile not found')
  return profile.organizationId
}

export async function getRosterData() {
  const orgId = await getOrgId()

  const [allSubs, orgSchools, allPriorityRows] = await Promise.all([
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
  ])

  // Build a map: schoolId → ordered sub IDs
  const priorityBySchool: Record<string, string[]> = {}
  for (const row of allPriorityRows) {
    const key = row.schoolId ?? '__org__'
    if (!priorityBySchool[key]) priorityBySchool[key] = []
    priorityBySchool[key].push(row.substituteId)
  }

  return { subs: allSubs, schools: orgSchools, priorityBySchool, orgId }
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
