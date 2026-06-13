import { db } from '@/db'
import { organizations, schools, users, billingEvents } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getBillingState } from '@/lib/billing'
import { getPlatformContext, recordCheckPayment, addBillingNote } from '../actions'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const EVENT_LABELS: Record<string, string> = {
  check_payment:   'Check payment recorded',
  stripe_payment:  'Stripe payment',
  status_change:   'Status changed',
  note:            'Note',
}

export default async function PlatformOrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  await getPlatformContext()

  const { orgId } = await params
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
  if (!org) notFound()

  const [orgSchools, orgUsers, events] = await Promise.all([
    db.query.schools.findMany({ where: eq(schools.organizationId, org.id) }),
    db.query.users.findMany({ where: eq(users.organizationId, org.id) }),
    db.query.billingEvents.findMany({
      where: eq(billingEvents.organizationId, org.id),
      orderBy: [desc(billingEvents.createdAt)],
      with: { creator: { columns: { firstName: true, lastName: true } } },
    }),
  ])

  const state = getBillingState(org)

  const statusLabel =
    state.status === 'trial_ending' ? `Trial — ${state.daysLeft} days left` :
    state.status === 'trial'         ? `Trial — ${state.daysLeft} days left` :
    state.status

  const roleCounts = orgUsers.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link href="/platform" className="text-gray-500 hover:text-gray-300 text-sm">← All orgs</Link>
        <h1 className="text-2xl font-bold text-white mt-2">{org.name}</h1>
        <p className="text-gray-400 text-sm">slug: {org.slug} · timezone: {org.timezone}</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: org info + billing status */}
        <div className="space-y-4">
          {/* Billing status */}
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Billing</p>
            <p className="text-white font-semibold capitalize">{statusLabel}</p>
            <div className="text-sm text-gray-400 space-y-0.5">
              <p>Method: {org.paymentMethod ?? 'stripe'}</p>
              <p>Paid through: {org.paidThrough ?? '—'}</p>
              {org.planNotes && <p>Notes: {org.planNotes}</p>}
            </div>
          </div>

          {/* Schools */}
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Schools ({orgSchools.length})</p>
            {orgSchools.map(s => (
              <p key={s.id} className="text-sm text-gray-300">{s.name}</p>
            ))}
          </div>

          {/* Users */}
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Users ({orgUsers.length})</p>
            {Object.entries(roleCounts).map(([role, ct]) => (
              <p key={role} className="text-sm text-gray-300 capitalize">{role}: {ct}</p>
            ))}
          </div>
        </div>

        {/* Right: actions */}
        <div className="space-y-4">
          {/* Record check payment */}
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <p className="text-sm font-semibold text-white mb-3">Record check payment</p>
            <form action={recordCheckPayment} className="space-y-3">
              <input type="hidden" name="orgId" value={org.id} />
              <div>
                <label className="block text-xs text-gray-400 mb-1">Amount ($)</label>
                <input type="number" name="amount" step="0.01" placeholder="e.g. 60.00"
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Paid through date</label>
                <input type="date" name="paidThrough" required
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Note (optional)</label>
                <input type="text" name="note" placeholder="Check #1234"
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
              </div>
              <button type="submit"
                className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                Save payment
              </button>
            </form>
          </div>

          {/* Add note */}
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <p className="text-sm font-semibold text-white mb-3">Add a note</p>
            <form action={addBillingNote} className="space-y-3">
              <input type="hidden" name="orgId" value={org.id} />
              <textarea name="note" rows={3} required placeholder="Internal note about this org…"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none" />
              <button type="submit"
                className="w-full rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">
                Save note
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Billing event timeline */}
      {events.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Billing history</p>
          <div className="space-y-3">
            {events.map(ev => (
              <div key={ev.id} className="flex gap-4 text-sm">
                <span className="text-gray-500 flex-shrink-0 w-32">
                  {ev.createdAt ? new Date(ev.createdAt).toLocaleDateString() : '—'}
                </span>
                <div className="flex-1">
                  <span className="text-gray-200">{EVENT_LABELS[ev.type] ?? ev.type}</span>
                  {ev.amountCents && (
                    <span className="text-green-400 ml-2">${(ev.amountCents / 100).toFixed(2)}</span>
                  )}
                  {ev.note && <p className="text-gray-400 text-xs mt-0.5">{ev.note}</p>}
                  {ev.creator && (
                    <p className="text-gray-600 text-xs">by {ev.creator.firstName} {ev.creator.lastName}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
