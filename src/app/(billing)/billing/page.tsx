import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users, organizations, employees, platformSettings } from '@/db/schema'
import { eq, countDistinct } from 'drizzle-orm'
import { getBillingState } from '@/lib/billing'
import { getEffectiveOrgId } from '@/lib/impersonation'
import { stripe } from '@/lib/stripe'
import Link from 'next/link'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [profile, settings] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, user.id) }),
    db.query.platformSettings.findFirst(),
  ])
  if (!profile) redirect('/auth/login')

  const effectiveOrgId = await getEffectiveOrgId(user.id)
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, effectiveOrgId ?? profile.organizationId) })
  if (!org) redirect('/auth/login')

  const state = getBillingState(org)
  const pricePerSeat = (settings?.pricePerSeatCents ?? 800) / 100
  const hasStripeSubscription = !!org.stripeSubscriptionId

  // Seat count
  let seats = org.seatCount
  if (!seats) {
    const [{ value: teacherCount }] = await db
      .select({ value: countDistinct(employees.userId) })
      .from(employees)
      .innerJoin(users, eq(employees.userId, users.id))
      .where(eq(users.organizationId, org.id))
    seats = Math.max(Number(teacherCount), 1)
  }
  const monthlyFull = seats * pricePerSeat

  // Fetch Stripe subscription to get actual discounted price
  let discountPercent: number | null = null
  let discountName: string | null = null
  let monthlyAfterDiscount: number | null = null
  if (org.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId, {
        expand: ['discounts.coupon'],
      })
      const firstDiscount = (sub.discounts as Array<{ coupon?: { percent_off?: number; name?: string } }>)?.[0]
      const coupon = firstDiscount?.coupon
      if (coupon?.percent_off) {
        discountPercent = coupon.percent_off
        discountName = coupon.name ?? null
        monthlyAfterDiscount = monthlyFull * (1 - coupon.percent_off / 100)
      }
    } catch { /* non-critical — show base price if Stripe unavailable */ }
  }

  const isAdmin = profile.isPlatformAdmin || profile.role === 'admin' || profile.role === 'principal'

  const statusLabel =
    state.status === 'active'       ? 'Active' :
    state.status === 'trial_ending' ? `Trial ending in ${state.daysLeft} day${state.daysLeft === 1 ? '' : 's'}` :
    state.status === 'trial'        ? `Free trial — ${state.daysLeft} days remaining` :
    state.status === 'past_due'     ? 'Past due' :
    state.status === 'expired'      ? 'Trial expired' : ''

  const statusColor =
    state.status === 'active'   ? 'bg-green-50 border-green-200 text-green-800' :
    state.status === 'expired'  ? 'bg-red-50 border-red-200 text-red-800' :
    state.status === 'past_due' ? 'bg-orange-50 border-orange-200 text-orange-800' :
                                  'bg-amber-50 border-amber-200 text-amber-800'

  const paidThrough = org.paidThrough
    ? new Date(org.paidThrough + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">{org.name}</p>
      </div>

      {/* Status banner */}
      <div className={`rounded-lg border px-5 py-4 ${statusColor}`}>
        <p className="font-semibold">{statusLabel}</p>
        {state.status === 'active' && paidThrough && (
          <p className="text-sm mt-1 opacity-80">Next billing date: {paidThrough}</p>
        )}
        {hasStripeSubscription && state.status === 'trial' && (
          <p className="text-sm mt-1 opacity-80">Your card is on file. Billing starts after your trial ends.</p>
        )}
        {state.status === 'expired' && (
          <p className="text-sm mt-1 opacity-80">Your free trial has ended. Subscribe below to continue using SubHub.</p>
        )}
        {state.status === 'past_due' && (
          <p className="text-sm mt-1 opacity-80">Your last payment didn&apos;t go through. Please update your payment method.</p>
        )}
      </div>

      {/* Pricing card */}
      <div className="rounded-lg border border-gray-200 bg-white px-6 py-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">SubHub Subscription</h2>
        <p className="text-sm text-gray-500 mb-4">
          ${pricePerSeat.toFixed(2)} per seat · per month · cancel anytime
        </p>

        {/* Price display — show discounted rate if coupon applied */}
        {discountPercent && monthlyAfterDiscount !== null ? (
          <div className="mb-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">${monthlyAfterDiscount.toFixed(2)}</span>
              <span className="text-gray-500 text-sm">/month</span>
              <span className="text-sm text-gray-400 line-through">${monthlyFull.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                {discountPercent}% off{discountName ? ` — ${discountName}` : ''}
              </span>
              <span className="text-xs text-gray-400">applied to your subscription</span>
            </div>
          </div>
        ) : (
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-3xl font-bold text-gray-900">${monthlyFull.toFixed(2)}</span>
            <span className="text-gray-500 text-sm">/month</span>
          </div>
        )}
        <p className="text-xs text-gray-400 mb-6">
          Based on {seats} seat{seats === 1 ? '' : 's'}
        </p>

        {/* Action — show Manage if subscribed, Subscribe if not */}
        {hasStripeSubscription || state.status === 'active' ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-green-700 font-medium">✓ Subscription set up</p>
            {isAdmin && (
              <form action="/api/stripe/portal" method="POST">
                <button type="submit" className="text-sm text-blue-600 hover:underline">
                  Manage subscription →
                </button>
              </form>
            )}
          </div>
        ) : isAdmin ? (
          <form action="/api/stripe/checkout" method="POST">
            <button type="submit"
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
              Subscribe with Credit Card
            </button>
          </form>
        ) : (
          <p className="text-sm text-gray-500">Contact your school admin to set up billing.</p>
        )}
      </div>

      {/* Check payment — only if not already subscribed */}
      {!hasStripeSubscription && state.status !== 'active' && (
        <div className="rounded-lg border border-gray-200 bg-white px-5 py-4">
          <p className="font-medium text-gray-900">Prefer to pay by check?</p>
          <p className="text-sm text-gray-500 mt-1">
            Email <a href="mailto:info@substitutes.us" className="text-blue-600 hover:underline">info@substitutes.us</a> and
            we&apos;ll send you an invoice. Your account will be activated as soon as payment is received.
          </p>
        </div>
      )}

      <Link href="/dashboard" className="inline-block text-sm text-gray-400 hover:text-gray-600 hover:underline">
        ← Back to dashboard
      </Link>
    </div>
  )
}
