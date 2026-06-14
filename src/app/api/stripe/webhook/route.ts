import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { db } from '@/db'
import { organizations, billingEvents } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Next.js App Router gives us the raw body via req.text() — no bodyParser config needed
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription') break

      const orgId = session.metadata?.orgId
      if (!orgId) break

      const customerId = session.customer as string
      const subscriptionId = session.subscription as string

      // In Stripe v22, current_period_end is on the subscription item, not the subscription itself
      const sub = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data'],
      })
      const periodEnd = sub.items.data[0]?.current_period_end
      const paidThrough = periodEnd
        ? new Date(periodEnd * 1000).toISOString().split('T')[0]
        : null

      await db.update(organizations)
        .set({
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: 'active',
          paidThrough,
          paymentMethod: 'stripe',
        })
        .where(eq(organizations.id, orgId))

      await db.insert(billingEvents).values({
        organizationId: orgId,
        type: 'stripe_payment',
        amountCents: session.amount_total ?? 0,
        note: `Stripe subscription started${paidThrough ? `. Billed through ${paidThrough}` : ''}.`,
        createdBy: null,
      })
      break
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice

      // Skip the first invoice — handled by checkout.session.completed above
      if (invoice.billing_reason === 'subscription_create') break

      // In Stripe v22, subscription ID is nested under invoice.parent
      const subRef = invoice.parent?.subscription_details?.subscription
      const subscriptionId = typeof subRef === 'string' ? subRef : subRef?.id
      if (!subscriptionId) break

      const sub = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data'],
      })
      const periodEnd = sub.items.data[0]?.current_period_end
      const paidThrough = periodEnd
        ? new Date(periodEnd * 1000).toISOString().split('T')[0]
        : null

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.stripeSubscriptionId, subscriptionId),
      })
      if (!org) break

      await db.update(organizations)
        .set({ subscriptionStatus: 'active', paidThrough })
        .where(eq(organizations.id, org.id))

      await db.insert(billingEvents).values({
        organizationId: org.id,
        type: 'stripe_payment',
        amountCents: invoice.amount_paid,
        note: `Stripe renewal payment${paidThrough ? `. Billed through ${paidThrough}` : ''}.`,
        createdBy: null,
      })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice

      const subRef = invoice.parent?.subscription_details?.subscription
      const subscriptionId = typeof subRef === 'string' ? subRef : subRef?.id
      if (!subscriptionId) break

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.stripeSubscriptionId, subscriptionId),
      })
      if (!org) break

      await db.update(organizations)
        .set({ subscriptionStatus: 'past_due' })
        .where(eq(organizations.id, org.id))

      await db.insert(billingEvents).values({
        organizationId: org.id,
        type: 'status_change',
        note: 'Stripe payment failed. Status set to past_due.',
        createdBy: null,
      })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.stripeSubscriptionId, sub.id),
      })
      if (!org) break

      await db.update(organizations)
        .set({ subscriptionStatus: 'expired' })
        .where(eq(organizations.id, org.id))

      await db.insert(billingEvents).values({
        organizationId: org.id,
        type: 'status_change',
        note: 'Stripe subscription cancelled. Status set to expired.',
        createdBy: null,
      })
      break
    }
  }

  return NextResponse.json({ received: true })
}
