import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, organizations, platformSettings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { stripe } from '@/lib/stripe'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile || (profile.role !== 'admin' && profile.role !== 'principal')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [org, settings] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(organizations.id, profile.organizationId) }),
    db.query.platformSettings.findFirst(),
  ])
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  const priceId = settings?.stripePriceId
  if (!priceId) return NextResponse.json({ error: 'Stripe price not configured' }, { status: 500 })

  const formData = await req.formData()
  const returnTo = formData.get('returnTo') as string | null
  const isOnboarding = returnTo === 'onboarding'

  // Save seat count if provided via form (onboarding flow passes it explicitly)
  const seatCountRaw = formData.get('seatCount')
  if (seatCountRaw) {
    const seatCount = Math.max(parseInt(seatCountRaw as string, 10), 1)
    await db.update(organizations)
      .set({ seatCount, updatedAt: new Date() })
      .where(eq(organizations.id, org.id))
    org.seatCount = seatCount
  }

  const quantity = Math.max(org.seatCount ?? 1, 1)

  // Trial days: onboarding default is 90 days (3 months); billing page is no trial
  const trialDaysRaw = formData.get('trialDays')
  const trialDays = trialDaysRaw ? parseInt(trialDaysRaw as string, 10) : (isOnboarding ? 90 : null)

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity }],
    success_url: isOnboarding
      ? `${APP_URL}/onboarding?billing=done`
      : `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: isOnboarding ? `${APP_URL}/onboarding` : `${APP_URL}/billing`,
    metadata: { orgId: org.id },
    allow_promotion_codes: true,
    ...(trialDays ? { subscription_data: { trial_period_days: trialDays } } : {}),
    ...(org.stripeCustomerId
      ? { customer: org.stripeCustomerId }
      : { customer_email: user.email ?? undefined }),
  })

  return NextResponse.redirect(session.url!, 303)
}
