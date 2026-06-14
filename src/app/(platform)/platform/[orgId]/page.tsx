import { db } from '@/db'
import { organizations, schools, users, billingEvents, invitations } from '@/db/schema'
import { eq, desc, and, isNull, gt } from 'drizzle-orm'
import { getBillingState } from '@/lib/billing'
import { getPlatformContext, recordCheckPayment, addBillingNote, setCronEnabled } from '../actions'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PlatformUsersSection } from './PlatformUsersSection'

const EVENT_LABELS: Record<string, string> = {
  check_payment:  'Check payment recorded',
  stripe_payment: 'Stripe payment',
  status_change:  'Status changed',
  note:           'Note',
}

export default async function PlatformOrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  await getPlatformContext()

  const { orgId } = await params
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
  if (!org) notFound()

  const now = new Date()

  const [orgSchools, orgUsers, events, pendingInvites] = await Promise.all([
    db.query.schools.findMany({ where: eq(schools.organizationId, org.id) }),
    db.query.users.findMany({ where: eq(users.organizationId, org.id), orderBy: (u, { asc }) => [asc(u.lastName)] }),
    db.query.billingEvents.findMany({
      where: eq(billingEvents.organizationId, org.id),
      orderBy: [desc(billingEvents.createdAt)],
      with: { creator: { columns: { firstName: true, lastName: true } } },
    }),
    db.query.invitations.findMany({
      where: and(
        eq(invitations.organizationId, org.id),
        isNull(invitations.usedAt),
        gt(invitations.expiresAt, now),
      ),
    }),
  ])

  // Fetch Supabase auth data for all users + pending invite emails
  const supabaseAdmin = createAdminClient()
  const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authByEmail = new Map(authUsers.map(u => [u.email ?? '', u]))

  // Augment org users with auth status
  const augmentedUsers = orgUsers.map(u => {
    const auth = authByEmail.get(u.email)
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      status: u.status,
      lastSignIn: auth?.last_sign_in_at ?? null,
      emailConfirmed: !!(auth?.email_confirmed_at),
    }
  })

  // Augment pending invites — isStuck = email confirmed in Supabase but no users row
  const orgUserEmails = new Set(orgUsers.map(u => u.email))
  const augmentedInvites = pendingInvites.map(inv => {
    const auth = authByEmail.get(inv.email)
    return {
      id: inv.id,
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt.toISOString(),
      isStuck: !!(auth?.email_confirmed_at) && !orgUserEmails.has(inv.email),
    }
  })

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
        {/* Left: org info */}
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Billing</p>
            <p className="text-white font-semibold capitalize">{statusLabel}</p>
            <div className="text-sm text-gray-400 space-y-0.5">
              <p>Method: {org.paymentMethod ?? 'stripe'}</p>
              <p>Paid through: {org.paidThrough ?? '—'}</p>
              {org.planNotes && <p>Notes: {org.planNotes}</p>}
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Schools ({orgSchools.length})</p>
            {orgSchools.map(s => (
              <p key={s.id} className="text-sm text-gray-300">{s.name}</p>
            ))}
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Users ({orgUsers.length})</p>
            {Object.entries(roleCounts).map(([role, ct]) => (
              <p key={role} className="text-sm text-gray-300 capitalize">{role}: {ct}</p>
            ))}
          </div>
        </div>

        {/* Right: billing actions */}
        <div className="space-y-4">
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

          {/* Cron kill switch */}
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <p className="text-sm font-semibold text-white mb-1">Notifications kill switch</p>
            <p className="text-xs text-gray-400 mb-3">
              When OFF, this school receives no sub blasts, re-blasts, or unfilled alerts.
              Use for expired accounts, test schools, or troubleshooting.
            </p>
            <div className="flex items-center gap-3 mb-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                org.cronEnabled
                  ? 'bg-green-900 text-green-300'
                  : 'bg-red-900 text-red-300'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${org.cronEnabled ? 'bg-green-400' : 'bg-red-400'}`} />
                {org.cronEnabled ? 'Notifications ON' : 'Notifications OFF'}
              </span>
            </div>
            <form action={setCronEnabled}>
              <input type="hidden" name="orgId" value={org.id} />
              <input type="hidden" name="enable" value={org.cronEnabled ? 'false' : 'true'} />
              <button type="submit" className={`w-full rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                org.cronEnabled
                  ? 'bg-red-900 text-red-300 hover:bg-red-800'
                  : 'bg-green-900 text-green-300 hover:bg-green-800'
              }`}>
                {org.cronEnabled ? 'Turn OFF notifications' : 'Turn ON notifications'}
              </button>
            </form>
          </div>

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

      {/* User management — IT support tools */}
      <PlatformUsersSection users={augmentedUsers} invites={augmentedInvites} />

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
