'use server'

/**
 * Server actions for the substitute portal.
 * Subs can view their assigned jobs and manage their availability calendar.
 */

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, substitutes, subAssignments, subUnavailability, subNotificationTokens, schools, schoolDirectory } from '@/db/schema'
import { eq, and, isNull, gt, asc, sql, ilike, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

async function getSubContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile || profile.role !== 'substitute') throw new Error('Substitute access required')

  const sub = await db.query.substitutes.findFirst({ where: eq(substitutes.userId, user.id) })
  if (!sub) throw new Error('Substitute profile not found')

  return { profile, sub }
}

export async function getMyAssignments() {
  const { sub } = await getSubContext()

  return db.query.subAssignments.findMany({
    where: eq(subAssignments.substituteId, sub.id),
    with: {
      school: true,
      timeOffLinks: {
        with: {
          timeOff: {
            with: {
              employee: { with: { user: true } },
              reason: true,
            },
          },
        },
      },
    },
    orderBy: (a, { desc }) => [desc(a.date)],
  })
}

/**
 * Returns a single assignment with full details for the sub job detail page.
 * Verifies the assignment belongs to the logged-in sub.
 */
export async function getMyAssignmentById(assignmentId: string) {
  const { sub } = await getSubContext()

  return db.query.subAssignments.findFirst({
    where: and(
      eq(subAssignments.id, assignmentId),
      eq(subAssignments.substituteId, sub.id)
    ),
    with: {
      school: true,
      timeOffLinks: {
        with: {
          timeOff: {
            with: {
              employee: { with: { user: true } },
              reason: true,
              attachments: true,
            },
          },
        },
      },
    },
  })
}

/**
 * Returns school profile info. Accessible to any authenticated substitute.
 */
export async function getSchoolProfile(schoolId: string) {
  const { sub } = await getSubContext()
  // Verify sub belongs to the same org as the school
  const profile = await db.query.users.findFirst({
    where: eq(users.id, sub.userId),
  })
  return db.query.schools.findFirst({
    where: and(
      eq(schools.id, schoolId),
      eq(schools.organizationId, profile?.organizationId ?? '')
    ),
  })
}

export async function getMyPendingTokens() {
  const { sub } = await getSubContext()

  const now = new Date()
  const rows = await db.query.subNotificationTokens.findMany({
    where: and(
      eq(subNotificationTokens.substituteId, sub.id),
      isNull(subNotificationTokens.usedAt),
      gt(subNotificationTokens.expiresAt, now)
    ),
    with: {
      teacherTimeOff: { with: { school: true } },
    },
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  })

  // Filter out jobs already filled by someone else
  return rows.filter(r => r.teacherTimeOff.subOutreachStatus !== 'filled')
}

export async function getMyUnavailableDates(year: number, month: number) {
  const { sub } = await getSubContext()

  // Get all unavailability rows for this sub (we'll filter client-side by month)
  const rows = await db
    .select({ date: subUnavailability.date })
    .from(subUnavailability)
    .where(eq(subUnavailability.substituteId, sub.id))

  return rows.map(r => r.date) // 'YYYY-MM-DD' strings
}

/**
 * Returns the logged-in sub's profile (name, phone, county).
 */
export async function getMyProfile() {
  const { profile, sub } = await getSubContext()
  return { profile, sub }
}

/**
 * Updates the sub's county and phone number.
 */
export async function updateMyProfile(data: { county: string; phone: string }) {
  const { profile, sub } = await getSubContext()

  await Promise.all([
    db.update(substitutes)
      .set({ county: data.county || null })
      .where(eq(substitutes.id, sub.id)),
    db.update(users)
      .set({ phone: data.phone || null })
      .where(eq(users.id, profile.id)),
  ])

  revalidatePath('/sub/profile')
  return { success: true }
}

/**
 * Returns distinct counties from the school directory, sorted alphabetically.
 */
export async function getDirectoryCounties() {
  const rows = await db
    .selectDistinct({ county: schoolDirectory.county })
    .from(schoolDirectory)
    .orderBy(asc(schoolDirectory.county))
  return rows.map(r => r.county)
}

/**
 * Returns schools from the directory for a given county.
 * Marks each school as "on SubHub" if it has been claimed by an org.
 */
export async function getDirectorySchoolsByCounty(county: string) {
  const rows = await db.query.schoolDirectory.findMany({
    where: eq(schoolDirectory.county, county),
    with: { claimedByOrg: true },
    orderBy: (s, { asc }) => [asc(s.schoolName)],
  })
  return rows
}

/**
 * Search the school directory by name, city, or district across all counties.
 * Optionally restrict to a specific county. Returns up to 30 results.
 */
export async function searchDirectory(query: string, county?: string) {
  await getSubContext()
  if (query.trim().length < 2) return []

  const nameCondition = or(
    ilike(schoolDirectory.schoolName, `%${query}%`),
    ilike(schoolDirectory.districtName, `%${query}%`),
    ilike(schoolDirectory.city, `%${query}%`),
  )

  const where = county
    ? and(nameCondition, eq(schoolDirectory.county, county))
    : nameCondition

  return db.query.schoolDirectory.findMany({
    where,
    with: { claimedByOrg: true },
    orderBy: (s, { asc }) => [asc(s.schoolName)],
    limit: 30,
  })
}

/**
 * Returns the count of schools per county (for display in county picker).
 */
export async function getDirectoryCountyCounts() {
  const rows = await db
    .select({
      county: schoolDirectory.county,
      count: sql<number>`count(*)::int`,
    })
    .from(schoolDirectory)
    .groupBy(schoolDirectory.county)
    .orderBy(asc(schoolDirectory.county))
  return rows
}

export async function toggleUnavailableDate(date: string) {
  const { sub } = await getSubContext()

  const existing = await db.query.subUnavailability.findFirst({
    where: and(
      eq(subUnavailability.substituteId, sub.id),
      eq(subUnavailability.date, date)
    ),
  })

  if (existing) {
    await db.delete(subUnavailability).where(eq(subUnavailability.id, existing.id))
  } else {
    await db.insert(subUnavailability).values({
      substituteId: sub.id,
      date,
    })
  }

  revalidatePath('/sub/availability')
  return { available: !!existing } // returns new state
}
