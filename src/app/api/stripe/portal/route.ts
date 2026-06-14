import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, organizations } from '@/db/schema'
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

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, profile.organizationId),
  })
  if (!org?.stripeCustomerId) {
    return NextResponse.json({ error: 'No Stripe customer on file' }, { status: 400 })
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${APP_URL}/billing`,
  })

  return NextResponse.redirect(portalSession.url, 303)
}
