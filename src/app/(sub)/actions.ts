'use server'

/**
 * Server actions for the substitute portal.
 * Subs can view their assigned jobs and manage their availability calendar.
 */

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, substitutes, subAssignments, subUnavailability, subNotificationTokens, schools, schoolDirectory, subSchoolAssignments, organizations } from '@/db/schema'
import { eq, and, isNull, gt, asc, sql, ilike, or, isNotNull } from 'drizzle-orm'
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
  const { profile, sub } = await getSubContext()

  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, profile.organizationId) })
  const TZ = org?.timezone ?? 'America/Los_Angeles'

  const now = new Date()
  const rows = await db.query.subNotificationTokens.findMany({
    where: and(
      eq(subNotificationTokens.substituteId, sub.id),
      isNull(subNotificationTokens.usedAt),
      gt(subNotificationTokens.expiresAt, now)
    ),
    with: {
      teacherTimeOff: { with: { school: true, employee: { with: { user: true } } } },
    },
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  })

  // Filter out jobs already filled, and dates where this sub is already booked
  const bookedRows = await db
    .select({ date: subAssignments.date })
    .from(subAssignments)
    .where(and(eq(subAssignments.substituteId, sub.id), eq(subAssignments.status, 'assigned')))
  const bookedDates = new Set(bookedRows.map(r => r.date))

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: TZ })

  return rows.filter(r =>
    r.teacherTimeOff.subOutreachStatus !== 'filled' &&
    !bookedDates.has(r.teacherTimeOff.startDate) &&
    r.teacherTimeOff.startDate >= todayStr  // never show past-date tokens
  )
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
 * Returns schools within a given radius (miles) of a lat/lng point.
 * Uses the Haversine formula in SQL. Returns up to 50 results sorted by distance.
 */
export async function searchSchoolsNearby(lat: number, lng: number, radiusMiles: number) {
  await getSubContext()

  const rows = await db.execute(sql`
    SELECT * FROM (
      SELECT
        id, school_name, district_name, county, city, address, state, zip, phone,
        school_type, grade_range, claimed_by_org_id,
        (3959 * acos(
          least(1.0,
            cos(radians(${lat})) * cos(radians(lat::float)) *
            cos(radians(lng::float) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(lat::float))
          )
        )) AS distance_miles
      FROM school_directory
      WHERE lat IS NOT NULL AND lng IS NOT NULL
    ) t
    WHERE distance_miles <= ${radiusMiles}
    ORDER BY distance_miles
    LIMIT 50
  `)

  return rows as unknown as {
    id: string
    school_name: string
    district_name: string | null
    county: string
    city: string | null
    address: string | null
    state: string | null
    zip: string | null
    phone: string | null
    school_type: string | null
    grade_range: string | null
    claimed_by_org_id: string | null
    distance_miles: number
  }[]
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

export async function saveAvatar(url: string) {
  const { profile } = await getSubContext()
  await db.update(users).set({ avatarUrl: url }).where(eq(users.id, profile.id))
  revalidatePath('/sub/profile')
}

export async function saveResume(url: string) {
  const { sub } = await getSubContext()
  await db.update(substitutes).set({ resumeUrl: url }).where(eq(substitutes.id, sub.id))
  revalidatePath('/sub/profile')
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

export async function getMySchoolStatus(schoolId: string) {
  const { sub, profile } = await getSubContext()
  const existing = await db.query.subSchoolAssignments.findFirst({
    where: and(
      eq(subSchoolAssignments.substituteId, sub.id),
      eq(subSchoolAssignments.schoolId, schoolId)
    ),
  })
  return { status: existing?.status ?? null, orgId: profile.organizationId }
}

export async function requestToJoinSchool(schoolId: string) {
  const { sub, profile } = await getSubContext()

  // Verify the school belongs to an org
  const school = await db.query.schools.findFirst({ where: eq(schools.id, schoolId) })
  if (!school) throw new Error('School not found')

  await db
    .insert(subSchoolAssignments)
    .values({
      substituteId: sub.id,
      schoolId,
      organizationId: school.organizationId,
      status: 'pending',
    })
    .onConflictDoNothing()

  revalidatePath(`/sub/schools/${schoolId}`)
  return { success: true }
}
