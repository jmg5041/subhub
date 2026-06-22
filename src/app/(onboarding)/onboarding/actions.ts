'use server'

import { db } from '@/db'
import { organizations, schools, campuses, schoolDirectory, users, platformSettings } from '@/db/schema'
import { eq, or, ilike } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Resend } from 'resend'

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
  districtName?: string
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

export async function addSchoolFromDirectory(directoryEntryId: string, campus?: string) {
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

export async function addCampus(data: {
  address?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
}) {
  const { orgId } = await getOnboardingContext()
  const [campus] = await db.insert(campuses).values({
    organizationId: orgId,
    address: data.address || null,
    city: data.city || null,
    state: data.state || 'CA',
    zip: data.zip || null,
    phone: data.phone || null,
  }).returning()
  return { campus }
}

export async function addSchoolToCampus(data: { campusId: string; name: string }) {
  const { orgId } = await getOnboardingContext()
  const [school] = await db.insert(schools).values({
    organizationId: orgId,
    name: data.name.trim(),
    campusId: data.campusId,
  }).returning()
  return { school }
}

export async function removeCampus(campusId: string) {
  const { orgId } = await getOnboardingContext()
  // Delete schools on this campus first, then the campus itself
  const campusSchools = await db.query.schools.findMany({ where: eq(schools.campusId, campusId) })
  for (const s of campusSchools) {
    if (s.organizationId === orgId) await db.delete(schools).where(eq(schools.id, s.id))
  }
  await db.delete(campuses).where(eq(campuses.id, campusId))
}

export async function saveSeatCount(seatCount: number) {
  const { orgId } = await getOnboardingContext()
  const count = Math.max(Math.round(seatCount), 1)
  await db.update(organizations)
    .set({ seatCount: count, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
}

// Called when a school chooses Option A (send bill) or Option B (25% off request).
// Saves seat count, sends staff alert, then completes onboarding on trial.
export async function submitDiscountRequest(formData: FormData): Promise<void> {
  const { orgId } = await getOnboardingContext()

  const option     = formData.get('option') as 'bill' | 'discount25'
  const seatCount  = Math.max(parseInt(formData.get('seatCount') as string, 10) || 1, 1)
  const software   = (formData.get('software') as string | null)?.trim() || null
  const annualCost = (formData.get('annualCost') as string | null)?.trim() || null

  const [settings] = await Promise.all([
    db.query.platformSettings.findFirst(),
    db.update(organizations)
      .set({ seatCount, paymentMethod: 'check', updatedAt: new Date() })
      .where(eq(organizations.id, orgId)),
  ])

  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
  const admin = await db.query.users.findFirst({
    where: eq(users.organizationId, orgId),
    columns: { email: true, firstName: true },
  })

  const pricePerSeat = (settings?.pricePerSeatCents ?? 800) / 100
  const monthlyFull = seatCount * pricePerSeat
  const staffEmail = settings?.staffAlertEmail
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

  if (staffEmail && resend) {
    const subject = option === 'bill'
      ? `Discount Request (Option A — Send Bill): ${org?.name}`
      : `Discount Request (Option B — 25% Off): ${org?.name}`

    const bodyLines = [
      `School: ${org?.name}`,
      `Admin: ${admin?.firstName ?? ''} <${admin?.email ?? ''}>`,
      `Seats: ${seatCount}`,
      `Full monthly rate: $${monthlyFull.toFixed(2)}/month`,
      option === 'bill'
        ? `Current software: ${software ?? '(not provided)'}`
        : `Requested discount: 25% off → $${(monthlyFull * 0.75).toFixed(2)}/month`,
      annualCost ? `Current annual cost: $${annualCost}` : '',
      '',
      `Review: ${appUrl}/platform/${orgId}`,
      `Action: Send them a Stripe promo code at ${admin?.email ?? 'their admin email'}`,
    ].filter(Boolean)

    await resend.emails.send({
      from: 'SubHub <no-reply@substitutes.us>',
      to: staffEmail,
      subject,
      text: bodyLines.join('\n'),
      html: bodyLines.map(l => `<p>${l}</p>`).join(''),
    })
  }

  redirect('/onboarding?billing=done')
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function saveBillingContact(data: { name: string; email: string }) {
  const { orgId } = await getOnboardingContext()
  await db.update(organizations)
    .set({ billingContactName: data.name || null, billingContactEmail: data.email || null, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
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
