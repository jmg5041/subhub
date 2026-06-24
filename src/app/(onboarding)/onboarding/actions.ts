'use server'

import { db } from '@/db'
import { organizations, schools, campuses, schoolDirectory, users, platformSettings } from '@/db/schema'
import { eq, or, ilike } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Resend } from 'resend'
import { stripe } from '@/lib/stripe'

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
    dayStartTime: null,  // intentionally blank — admin must explicitly set during Step 4
    dayEndTime: null,
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

export async function resetBilling() {
  const { orgId } = await getOnboardingContext()
  await db.update(organizations)
    .set({ paymentMethod: 'stripe', seatCount: null, stripeCustomerId: null, stripeSubscriptionId: null, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
}

export async function saveSeatCount(seatCount: number) {
  const { orgId } = await getOnboardingContext()
  const count = Math.max(Math.round(seatCount), 1)
  await db.update(organizations)
    .set({ seatCount: count, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
}

// Called when a school chooses Option A (send bill) or Option B (25% off request).
export async function submitDiscountRequest(formData: FormData): Promise<void> {
  const { orgId } = await getOnboardingContext()

  const option     = formData.get('option') as 'bill' | 'discount25'
  const seatCount  = Math.max(parseInt(formData.get('seatCount') as string, 10) || 1, 1)
  const software   = (formData.get('software') as string | null)?.trim() || null
  const annualCost = (formData.get('annualCost') as string | null)?.trim() || null
  const billFile   = formData.get('bill') instanceof File ? formData.get('bill') as File : null

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

  // ── Option B: generate a real Stripe promo code ────────────────────────────
  let generatedCode: string | null = null
  if (option === 'discount25') {
    const slug = (org?.slug ?? 'school').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
    // Try the clean code first; if it already exists in Stripe (e.g. repeated onboarding),
    // append a short unique suffix so we always get a working code
    const baseCodes = [`SAVE25-${slug}`, `SAVE25-${slug}-2`, `SAVE25-${slug}-3`]
    for (const code of baseCodes) {
      try {
        const coupon = await stripe.coupons.create({ percent_off: 25, duration: 'forever' })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (stripe.promotionCodes.create as any)({
          coupon: coupon.id,
          code,
          expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
          max_redemptions: 3,
        })
        generatedCode = code
        await db.update(organizations)
          .set({ planNotes: `PROMO:${code}`, updatedAt: new Date() })
          .where(eq(organizations.id, orgId))
        break
      } catch (err) {
        console.error(`[PROMO CODE] Failed to create ${code}:`, err)
        // Loop continues to try the next suffix
      }
    }
    if (!generatedCode) {
      console.error('[PROMO CODE] All attempts failed — IT must create manually')
    }
  }

  // ── Send staff alert email ─────────────────────────────────────────────────
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
        : `Promo code generated: ${generatedCode ?? '(generation failed — create manually)'}`,
      annualCost ? `Current annual cost: $${annualCost}` : '',
      '',
      `Review: ${appUrl}/platform/${orgId}`,
    ].filter(Boolean)

    // Attach uploaded bill file if present (Option A)
    const attachments: { filename: string; content: string }[] = []
    if (billFile && billFile.size > 0 && billFile.size <= 20 * 1024 * 1024) {
      const buffer = Buffer.from(await billFile.arrayBuffer())
      attachments.push({ filename: billFile.name, content: buffer.toString('base64') })
    }

    await resend.emails.send({
      from: 'SubHub <no-reply@substitutes.us>',
      to: staffEmail,
      subject,
      text: bodyLines.join('\n'),
      html: bodyLines.map(l => `<p>${l}</p>`).join(''),
      attachments: attachments.length > 0 ? attachments : undefined,
    })
  }

  if (option === 'discount25' && generatedCode) {
    redirect(`/onboarding?billing=promo&code=${encodeURIComponent(generatedCode)}`)
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

// Stamps onboarding complete, sends confirmation email, and sends the user to /dashboard.
export async function completeOnboarding() {
  const { orgId } = await getOnboardingContext()
  await db.update(organizations)
    .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(organizations.id, orgId))

  // Send confirmation email to all admins + billing contact
  if (resend) {
    const [org, settings, admins, orgSchools] = await Promise.all([
      db.query.organizations.findFirst({ where: eq(organizations.id, orgId) }),
      db.query.platformSettings.findFirst(),
      db.select({ email: users.email, firstName: users.firstName })
        .from(users)
        .where(eq(users.organizationId, orgId)),
      db.select({ name: schools.name }).from(schools).where(eq(schools.organizationId, orgId)),
    ])

    if (org) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'
      const pricePerSeat = (settings?.pricePerSeatCents ?? 800) / 100
      const seats = org.seatCount ?? 0
      const monthlyTotal = (seats * pricePerSeat).toFixed(2)
      const schoolList = orgSchools.map(s => s.name).join(', ')

      const recipients = [...new Set([
        ...admins.map(a => a.email).filter(Boolean),
        org.billingContactEmail,
      ].filter(Boolean) as string[])]

      const subject = `SubHub is ready for ${org.name}`
      const html = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <div style="background:#2563eb;padding:20px 24px;">
            <h1 style="color:white;margin:0;font-size:20px;">SubHub</h1>
            <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">substitutes.us</p>
          </div>
          <div style="padding:24px;">
            <h2 style="margin-top:0;color:#111;">You're all set up!</h2>
            <p style="color:#374151;">Setup for <strong>${org.name}</strong> is complete. Here's a summary of your account:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;width:140px;">Schools</td><td style="padding:8px 0;font-size:14px;">${schoolList}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Seats</td><td style="padding:8px 0;font-size:14px;">${seats} teacher seats</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Monthly rate</td><td style="padding:8px 0;font-size:14px;">$${monthlyTotal}/month</td></tr>
            </table>
            <h3 style="color:#111;margin-top:24px;">What happens next</h3>
            <ul style="color:#374151;padding-left:20px;line-height:1.8;">
              <li>Substitutes will be notified at <strong>9pm</strong> the night before any approved absence</li>
              <li>A morning re-blast goes out at <strong>6am</strong> for any still-unfilled positions</li>
              <li>You'll be alerted at 6:30am if a position is still open</li>
            </ul>
            <h3 style="color:#111;margin-top:24px;">Before your first absence</h3>
            <ul style="color:#374151;padding-left:20px;line-height:1.8;">
              <li>Make sure each school has its start and end times configured</li>
              <li>Import your teachers and substitutes if you haven't already</li>
              <li>Substitutes will receive a welcome email when imported</li>
            </ul>
            <div style="margin:28px 0;">
              <a href="${appUrl}/dashboard" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">Go to Dashboard</a>
            </div>
            <p style="color:#6b7280;font-size:12px;">Questions? Reply to this email or visit <a href="https://substitutes.us" style="color:#2563eb;">substitutes.us</a>.</p>
          </div>
        </div>`
      const text = `You're all set up!\n\n${org.name} is ready on SubHub.\n\nSchools: ${schoolList}\nSeats: ${seats}\nMonthly rate: $${monthlyTotal}/month\n\nSubs will be notified at 9pm the night before any approved absence, with a 6am re-blast for unfilled positions.\n\nDashboard: ${appUrl}/dashboard`

      for (const to of recipients) {
        await resend.emails.send({ from: 'SubHub <no-reply@substitutes.us>', to, subject, html, text })
          .catch(() => {})
      }
    }
  }

  redirect('/dashboard')
}
