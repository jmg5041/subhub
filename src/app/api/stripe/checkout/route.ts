import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, organizations, employees } from '@/db/schema'
import { eq, countDistinct } from 'drizzle-orm'
import { stripe } from '@/lib/stripe'

const PRICE_ID = 'price_1Ti1dlB7AVFO3ftiA0nOLuxN'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile || (profile.role !== 'admin' && profile.role !== 'principal')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, profile.organizationId),
  })
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  // Count distinct teachers in this org (employees → users to get org)
  const [{ value: teacherCount }] = await db
    .select({ value: countDistinct(employees.userId) })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .where(eq(users.organizationId, profile.organizationId))

  const quantity = Math.max(Number(teacherCount), 1)

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: PRICE_ID, quantity }],
    success_url: `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/billing`,
    metadata: { orgId: org.id },
    allow_promotion_codes: true,
    // Reuse existing Stripe customer if we have one
    ...(org.stripeCustomerId
      ? { customer: org.stripeCustomerId }
      : { customer_email: user.email ?? undefined }),
  })

  return NextResponse.redirect(session.url!, 303)
}
