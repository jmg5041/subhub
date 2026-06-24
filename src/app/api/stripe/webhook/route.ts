import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { db } from '@/db'
import { organizations, billingEvents, users, platformSettings } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { Resend } from 'resend'
import { emailHeader } from '@/lib/email-utils'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

async function sendSubscriptionActivatedEmail(orgId: string, seats: number, paidThrough: string | null) {
  if (!resend) return
  const [org, settings, admins] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(organizations.id, orgId) }),
    db.query.platformSettings.findFirst(),
    db.select({ email: users.email })
      .from(users)
      .where(eq(users.organizationId, orgId)),
  ])
  if (!org) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'
  const pricePerSeat = (settings?.pricePerSeatCents ?? 800) / 100
  const monthlyTotal = (seats * pricePerSeat).toFixed(2)

  const recipients = [...new Set([
    ...admins.map(a => a.email).filter(Boolean),
    org.billingContactEmail,
  ].filter(Boolean) as string[])]

  const subject = `Your SubHub subscription is active — ${org.name}`
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      ${emailHeader(settings?.logoUrl)}
      <div style="padding:24px;">
        <h2 style="margin-top:0;color:#111;">Subscription Activated</h2>
        <p style="color:#374151;">Your SubHub subscription for <strong>${org.name}</strong> is now active.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;width:160px;">Seats</td><td style="padding:8px 0;font-size:14px;">${seats}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Monthly charge</td><td style="padding:8px 0;font-size:14px;">$${monthlyTotal}/month</td></tr>
          ${paidThrough ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">First billing date</td><td style="padding:8px 0;font-size:14px;">${paidThrough}</td></tr>` : ''}
        </table>
        <div style="margin:24px 0;">
          <a href="${appUrl}/billing" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">View Billing</a>
        </div>
        <p style="color:#6b7280;font-size:12px;">To manage your subscription, update payment methods, or view invoices, visit your billing page.</p>
      </div>
    </div>`
  const text = `Your SubHub subscription for ${org.name} is now active.\n\nSeats: ${seats}\nMonthly charge: $${monthlyTotal}/month${paidThrough ? `\nFirst billing date: ${paidThrough}` : ''}\n\nManage billing: ${appUrl}/billing`

  for (const to of recipients) {
    await resend.emails.send({ from: 'SubHub <no-reply@substitutes.us>', to, subject, html, text })
      .catch(() => {})
  }
}

async function sendPaymentReceivedEmail(orgId: string, amountCents: number, paidThrough: string | null) {
  if (!resend) return
  const [org, settings, admins] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(organizations.id, orgId) }),
    db.query.platformSettings.findFirst(),
    db.select({ email: users.email }).from(users).where(eq(users.organizationId, orgId)),
  ])
  if (!org) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'
  const amountDollars = (amountCents / 100).toFixed(2)
  const nextDate = paidThrough
    ? new Date(paidThrough + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  const recipients = [...new Set([
    ...admins.map(a => a.email).filter(Boolean),
    org.billingContactEmail,
  ].filter(Boolean) as string[])]

  const subject = `Payment received — SubHub ${org.name}`
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      ${emailHeader(settings?.logoUrl)}
      <div style="padding:24px;">
        <h2 style="margin-top:0;color:#111;">Payment Received</h2>
        <p style="color:#374151;">Thank you — your SubHub payment for <strong>${org.name}</strong> has been received.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;width:160px;">Amount</td><td style="padding:8px 0;font-size:14px;font-weight:600;">$${amountDollars}</td></tr>
          ${nextDate ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Next charge</td><td style="padding:8px 0;font-size:14px;">${nextDate}</td></tr>` : ''}
        </table>
        <a href="${appUrl}/billing" style="display:inline-block;background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">View Billing</a>
      </div>
    </div>`
  const text = `Payment received for ${org.name}: $${amountDollars}.${nextDate ? ` Next charge: ${nextDate}.` : ''}\n\nView billing: ${appUrl}/billing`

  for (const to of recipients) {
    await resend.emails.send({ from: 'SubHub <no-reply@substitutes.us>', to, subject, html, text })
      .catch(() => {})
  }
}

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

      // In Stripe v22, current_period_end is on the subscription item
      const sub = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data'],
      })
      const periodEnd = sub.items.data[0]?.current_period_end
      const paidThrough = periodEnd
        ? new Date(periodEnd * 1000).toISOString().split('T')[0]
        : null

      // If subscription is trialing, status stays 'trial' in our DB until trial ends
      const newStatus = sub.status === 'trialing' ? 'trial' : 'active'

      await db.update(organizations)
        .set({
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: newStatus,
          paidThrough,
          paymentMethod: 'stripe',
          cronEnabled: true,
        })
        .where(eq(organizations.id, orgId))

      await db.insert(billingEvents).values({
        organizationId: orgId,
        type: 'stripe_payment',
        amountCents: session.amount_total ?? 0,
        note: newStatus === 'trial'
          ? `Stripe subscription started with trial period${paidThrough ? `. Trial through ${paidThrough}` : ''}.`
          : `Stripe subscription started${paidThrough ? `. Billed through ${paidThrough}` : ''}.`,
        createdBy: null,
      })

      await sendSubscriptionActivatedEmail(orgId, sub.items.data[0]?.quantity ?? 0, paidThrough)
      break
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice

      // Skip the first invoice on a new subscription — handled by checkout.session.completed
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
        .set({ subscriptionStatus: 'active', paidThrough, cronEnabled: true })
        .where(eq(organizations.id, org.id))

      await db.insert(billingEvents).values({
        organizationId: org.id,
        type: 'stripe_payment',
        amountCents: invoice.amount_paid,
        note: `Stripe renewal payment${paidThrough ? `. Billed through ${paidThrough}` : ''}.`,
        createdBy: null,
      })

      await sendPaymentReceivedEmail(org.id, invoice.amount_paid, paidThrough)
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
        .set({ subscriptionStatus: 'past_due', cronEnabled: false })
        .where(eq(organizations.id, org.id))

      await db.insert(billingEvents).values({
        organizationId: org.id,
        type: 'status_change',
        note: 'Stripe payment failed. Status set to past_due. Notifications disabled.',
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
        .set({ subscriptionStatus: 'expired', cronEnabled: false })
        .where(eq(organizations.id, org.id))

      await db.insert(billingEvents).values({
        organizationId: org.id,
        type: 'status_change',
        note: 'Stripe subscription cancelled. Status set to expired. Notifications disabled.',
        createdBy: null,
      })
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.stripeSubscriptionId, sub.id),
      })
      if (!org) break

      // Map Stripe subscription status to our internal status
      const periodEnd = sub.items.data[0]?.current_period_end
      const paidThrough = periodEnd
        ? new Date(periodEnd * 1000).toISOString().split('T')[0]
        : null

      const statusMap: Record<string, string> = {
        active: 'active',
        trialing: 'trial',
        past_due: 'past_due',
        canceled: 'expired',
        unpaid: 'past_due',
      }
      const newStatus = statusMap[sub.status] ?? org.subscriptionStatus ?? 'trial'

      await db.update(organizations)
        .set({ subscriptionStatus: newStatus, paidThrough })
        .where(eq(organizations.id, org.id))

      await db.insert(billingEvents).values({
        organizationId: org.id,
        type: 'status_change',
        note: `Stripe subscription updated. Status: ${sub.status}${paidThrough ? `. Period through ${paidThrough}` : ''}.`,
        createdBy: null,
      })
      break
    }

    case 'customer.subscription.trial_will_end': {
      const sub = event.data.object as Stripe.Subscription

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.stripeSubscriptionId, sub.id),
      })
      if (!org) break

      // Log the event — email reminder to admin is future work (Resend)
      await db.insert(billingEvents).values({
        organizationId: org.id,
        type: 'status_change',
        note: 'Stripe trial ending in 3 days. Admin should be notified.',
        createdBy: null,
      })
      break
    }
  }

  return NextResponse.json({ received: true })
}
