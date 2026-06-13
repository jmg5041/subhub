import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users, organizations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getBillingState } from '@/lib/billing'
import Link from 'next/link'

const TIERS = [
  { label: 'Small School',  subtitle: 'Up to 50 teachers', price: '$5 / year'  },
  { label: 'Medium School', subtitle: '51–150 teachers',   price: '$6 / year'  },
  { label: 'Large School',  subtitle: '151+ teachers',      price: '$7 / year'  },
]

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile) redirect('/auth/login')

  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, profile.organizationId) })
  if (!org) redirect('/auth/login')

  const state = getBillingState(org)

  // Active orgs shouldn't be here — send them back
  if (state.status === 'active') redirect('/dashboard')

  const statusLabel =
    state.status === 'trial_ending' ? `Trial ending in ${state.daysLeft} day${state.daysLeft === 1 ? '' : 's'}` :
    state.status === 'trial'        ? `Free trial — ${state.daysLeft} days remaining` :
    state.status === 'past_due'     ? 'Past due' :
    state.status === 'expired'      ? 'Trial expired' : ''

  const statusColor =
    state.status === 'expired'      ? 'bg-red-50 border-red-200 text-red-800' :
    state.status === 'past_due'     ? 'bg-orange-50 border-orange-200 text-orange-800' :
                                      'bg-amber-50 border-amber-200 text-amber-800'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">{org.name}</p>
      </div>

      {/* Status card */}
      <div className={`rounded-lg border px-5 py-4 ${statusColor}`}>
        <p className="font-semibold">{statusLabel}</p>
        {state.status === 'expired' && (
          <p className="text-sm mt-1 opacity-80">Your free trial has ended. Subscribe below to continue using SubHub, or pay by check.</p>
        )}
        {state.status === 'past_due' && (
          <p className="text-sm mt-1 opacity-80">Your payment didn&apos;t go through. Update your payment method to restore full access.</p>
        )}
      </div>

      {/* Subscription tiers */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Choose a plan</h2>
        <div className="grid grid-cols-3 gap-4">
          {TIERS.map((tier) => (
            <div key={tier.label} className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col gap-2">
              <p className="font-semibold text-gray-900">{tier.label}</p>
              <p className="text-xs text-gray-500">{tier.subtitle}</p>
              <p className="text-lg font-bold text-blue-600 mt-1">{tier.price}</p>
              <button
                disabled
                className="mt-auto rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white opacity-40 cursor-not-allowed"
              >
                Coming soon
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">Online payments launching soon. All plans include ACH bank transfer.</p>
      </div>

      {/* Check payment option */}
      <div className="rounded-lg border border-gray-200 bg-white px-5 py-4">
        <p className="font-medium text-gray-900">Prefer to pay by check?</p>
        <p className="text-sm text-gray-500 mt-1">
          Email <a href="mailto:info@substitutes.us" className="text-blue-600 hover:underline">info@substitutes.us</a> and
          we&apos;ll send you an invoice. Your account will be activated as soon as payment is received.
        </p>
      </div>

      <Link href="/dashboard" className="inline-block text-sm text-gray-400 hover:text-gray-600 hover:underline">
        ← Back to dashboard
      </Link>
    </div>
  )
}
