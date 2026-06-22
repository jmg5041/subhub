import { db } from '@/db'
import { organizations, users, platformSettings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { seedDefaultAbsenceReasons } from '@/lib/org-defaults'
import type { User } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Returns a unique org slug, appending -2, -3, etc. on collision
async function uniqueSlug(base: string): Promise<string> {
  let slug = base
  let suffix = 2
  while (true) {
    const existing = await db.query.organizations.findFirst({ where: eq(organizations.slug, slug) })
    if (!existing) return slug
    slug = `${base}-${suffix++}`
  }
}

// Creates the org, admin user row, and default absence reasons for a self-signup.
// Idempotent: safe to call twice (re-confirms, double-click, etc.).
export async function provisionSelfSignupOrg(authUser: User): Promise<void> {
  // If the users row already exists, provisioning already happened
  const existing = await db.query.users.findFirst({ where: eq(users.id, authUser.id) })
  if (existing) return

  const meta = authUser.user_metadata ?? {}
  const orgName = (meta.orgName as string) || 'My School'
  const firstName = (meta.firstName as string) || authUser.email?.split('@')[0] || 'Admin'
  const lastName = (meta.lastName as string) || ''

  // 120-day free trial
  const paidThrough = new Date()
  paidThrough.setDate(paidThrough.getDate() + 120)

  const slug = await uniqueSlug(slugify(orgName))

  const [org] = await db.insert(organizations).values({
    name: orgName,
    slug,
    districtName: orgName, // pre-populate from signup so onboarding Step 1 is pre-filled
    subscriptionStatus: 'trial',
    paidThrough: paidThrough.toISOString().slice(0, 10),
    paymentMethod: 'stripe',
    onboardingCompletedAt: null,
  }).returning()

  await db.insert(users).values({
    id: authUser.id,
    email: authUser.email!,
    firstName,
    lastName,
    role: 'admin',
    organizationId: org.id,
  })

  await seedDefaultAbsenceReasons(org.id)

  // Alert platform staff of new signup
  const settings = await db.query.platformSettings.findFirst()
  if (settings?.staffAlertEmail && resend) {
    const subject = `New signup: ${orgName}`
    const text = [
      `New school signed up for SubHub.`,
      ``,
      `School: ${orgName}`,
      `Admin: ${firstName} ${lastName} <${authUser.email}>`,
      `Trial ends: ${paidThrough.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      ``,
      `View in platform: ${APP_URL}/platform/${org.id}`,
    ].join('\n')
    const html = `
      <p>New school signed up for SubHub.</p>
      <ul>
        <li><strong>School:</strong> ${orgName}</li>
        <li><strong>Admin:</strong> ${firstName} ${lastName} &lt;${authUser.email}&gt;</li>
        <li><strong>Trial ends:</strong> ${paidThrough.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</li>
      </ul>
      <p><a href="${APP_URL}/platform/${org.id}">View in platform →</a></p>
    `
    await resend.emails.send({
      from: 'SubHub <no-reply@substitutes.us>',
      to: settings.staffAlertEmail,
      subject,
      text,
      html,
    })
  }
}
