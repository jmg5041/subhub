import { db } from '@/db'
import { organizations, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { seedDefaultAbsenceReasons } from '@/lib/org-defaults'
import type { User } from '@supabase/supabase-js'

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
}
