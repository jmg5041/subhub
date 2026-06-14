'use server'

import { db } from '@/db'
import { organizations, schools, schoolDirectory, users } from '@/db/schema'
import { eq, or, ilike } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

async function getOnboardingContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile) throw new Error('Profile not found')
  if (!['admin', 'principal', 'staff'].includes(profile.role)) throw new Error('Not authorized')

  return { orgId: profile.organizationId }
}

export async function saveOrgBasics(data: {
  timezone: string
  subPayModel: string
  halfDayHours: string
  fullDayHours: string
  autoNotifySubs: boolean
  notifyByEmail: boolean
  notifyBySms: boolean
  notifyByPhone: boolean
}) {
  const { orgId } = await getOnboardingContext()
  await db.update(organizations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
}

export async function searchOrgDirectory(query: string) {
  await getOnboardingContext()
  if (query.trim().length < 2) return []

  return db.query.schoolDirectory.findMany({
    where: or(
      ilike(schoolDirectory.schoolName, `%${query}%`),
      ilike(schoolDirectory.districtName, `%${query}%`),
      ilike(schoolDirectory.city, `%${query}%`),
    ),
    orderBy: (s, { asc }) => [asc(s.schoolName)],
    limit: 20,
  })
}

export async function addSchoolFromDirectory(directoryEntryId: string) {
  const { orgId } = await getOnboardingContext()

  const entry = await db.query.schoolDirectory.findFirst({
    where: eq(schoolDirectory.id, directoryEntryId),
  })
  if (!entry) return { error: 'Directory entry not found' }

  const [school] = await db.insert(schools).values({
    organizationId: orgId,
    name: entry.schoolName,
    address: entry.address ?? undefined,
    city: entry.city ?? undefined,
    state: entry.state ?? 'CA',
    zip: entry.zip ?? undefined,
    phone: entry.phone ?? undefined,
    county: entry.county,
  }).returning()

  await db.update(schoolDirectory)
    .set({ claimedByOrgId: orgId })
    .where(eq(schoolDirectory.id, directoryEntryId))

  return { school }
}

export async function addSchoolManually(data: {
  name: string
  dayStartTime: string
  dayEndTime: string
}) {
  const { orgId } = await getOnboardingContext()

  const [school] = await db.insert(schools).values({
    organizationId: orgId,
    name: data.name,
    dayStartTime: data.dayStartTime,
    dayEndTime: data.dayEndTime,
  }).returning()

  return { school }
}

export async function removeOnboardingSchool(schoolId: string) {
  const { orgId } = await getOnboardingContext()

  const school = await db.query.schools.findFirst({ where: eq(schools.id, schoolId) })
  if (!school || school.organizationId !== orgId) return { error: 'Not found' }

  await db.delete(schools).where(eq(schools.id, schoolId))
  return { success: true }
}

export async function saveBillingPreference(method: 'check') {
  const { orgId } = await getOnboardingContext()
  await db.update(organizations)
    .set({ paymentMethod: method, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
}

// Stamps onboarding complete and sends the user to /dashboard.
export async function completeOnboarding() {
  const { orgId } = await getOnboardingContext()
  await db.update(organizations)
    .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
  redirect('/dashboard')
}
