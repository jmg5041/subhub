import { db } from '@/db'
import { organizations, schools, users, billingEvents, invitations } from '@/db/schema'
import { eq, desc, and, isNull, gt, sql } from 'drizzle-orm'
import { getBillingState } from '@/lib/billing'
import { getPlatformContext, recordCheckPayment, addBillingNote, setCronEnabled, deleteOrganization, updateOrgIdentity, clearPlanNotes } from '../actions'
import { setImpersonation } from '@/lib/impersonation-actions'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PlatformUsersSection } from './PlatformUsersSection'
import { InvitePlatformStaffForm } from './InvitePlatformStaffForm'

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

  // Platform org: show IT staff management only — no billing, no danger zone
  if (org.slug === 'subhub-platform') {
    const supabaseAdmin = createAdminClient()
    const orgUsers = await db.query.users.findMany({
      where: eq(users.organizationId, org.id),
      orderBy: (u, { asc }) => [asc(u.lastName)],
    })
    const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const authByEmail = new Map(authUsers.map(u => [u.email ?? '', u]))

    // Detect which staff have active sessions right now
    const activeSessionIds = new Set<string>()
    if (orgUsers.length > 0) {
      try {
        const staffIds = orgUsers.map(u => u.id)
        const result = await db.execute(sql`
          SELECT DISTINCT user_id::text as uid
          FROM auth.sessions
          WHERE not_after > now()
          AND user_id = ANY(ARRAY[${sql.join(staffIds.map(id => sql`${id}::uuid`), sql`, `)}])
        `)
        for (const row of result) {
          if (typeof (row as { uid?: unknown }).uid === 'string') {
            activeSessionIds.add((row as { uid: string }).uid)
          }
        }
      } catch {
        // auth.sessions inaccessible — show all as offline
      }
    }

    const augmentedUsers = orgUsers.map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      status: u.status,
      lastSignIn: authByEmail.get(u.email)?.last_sign_in_at ?? null,
      emailConfirmed: !!(authByEmail.get(u.email)?.email_confirmed_at),
      isOnline: activeSessionIds.has(u.id),
    }))

    return (
      <div className="space-y-6">
        <div>
          <Link href="/platform" className="text-gray-500 hover:text-gray-300 text-sm">← All orgs</Link>
          <h1 className="text-2xl font-bold text-white mt-2">IT Staff</h1>
          <p className="text-gray-400 text-sm">SubHub platform administrators. These users have access to all organizations.</p>
        </div>

        <InvitePlatformStaffForm orgId={org.id} />

        <PlatformUsersSection users={augmentedUsers} invites={[]} showOnline />
      </div>
    )
  }

  const now = new Date()

  const settings = await db.query.platformSettings.findFirst()

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
      <div className="flex items-start justify-between">
        <div>
          <Link href="/platform" className="text-gray-500 hover:text-gray-300 text-sm">← All orgs</Link>
          <h1 className="text-2xl font-bold text-white mt-2">{org.name}</h1>
          {org.districtName && org.districtName !== org.name && (
            <p className="text-indigo-400 text-sm">District: {org.districtName}</p>
          )}
          <p className="text-gray-400 text-sm">slug: {org.slug} · timezone: {org.timezone}</p>
        </div>
        {org.slug !== 'subhub-platform' && (
          <form action={setImpersonation}>
            <input type="hidden" name="orgId" value={org.id} />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
            >
              View as Admin →
            </button>
          </form>
        )}
      </div>

      {/* Discount request action card */}
      {org.planNotes?.startsWith('PROMO:') && (() => {
        const promoCode = org.planNotes.replace('PROMO:', '')
        const pricePerSeat = (settings?.pricePerSeatCents ?? 800) / 100
        const seats = org.seatCount ?? 0
        const fullMonthly = seats * pricePerSeat
        const discountedMonthly = fullMonthly * 0.75
        return (
          <div className="rounded-lg border border-yellow-600 bg-yellow-950 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-yellow-300 uppercase tracking-wider">⚡ Action Required — 25% Discount Request</p>
              <form action={clearPlanNotes}>
                <input type="hidden" name="orgId" value={org.id} />
                <button type="submit" className="text-xs text-yellow-600 hover:text-yellow-400 underline">Mark as handled</button>
              </form>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-yellow-500 text-xs uppercase tracking-wide">Promo code to send</p>
                <p className="font-mono text-white text-base font-bold">{promoCode}</p>
              </div>
              <div className="space-y-1">
                <p className="text-yellow-500 text-xs uppercase tracking-wide">Send to</p>
                <p className="text-white">{org.billingContactEmail ?? org.billingContactName ?? '—'}</p>
                {org.billingContactName && org.billingContactEmail && (
                  <p className="text-yellow-700 text-xs">{org.billingContactName}</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-yellow-500 text-xs uppercase tracking-wide">Seats × rate</p>
                <p className="text-white">{seats} seats × ${pricePerSeat}/mo = <span className="line-through text-yellow-700">${fullMonthly.toFixed(2)}</span></p>
              </div>
              <div className="space-y-1">
                <p className="text-yellow-500 text-xs uppercase tracking-wide">After 25% off</p>
                <p className="text-green-400 font-semibold">${discountedMonthly.toFixed(2)}/month</p>
              </div>
            </div>
            <p className="text-xs text-yellow-700">
              Apply this code in Stripe → Customers → find by email → add promotion code. Or email the code directly to the billing contact so they enter it at checkout.
            </p>
          </div>
        )
      })()}

      <div className="grid grid-cols-2 gap-6">
        {/* Left: org info */}
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Billing</p>
            <p className="text-white font-semibold capitalize">{statusLabel}</p>
            <div className="text-sm text-gray-400 space-y-0.5">
              <p>Method: {org.paymentMethod ?? 'stripe'}</p>
              <p>Paid through: {org.paidThrough ?? '—'}</p>
              <p>Seats: {org.seatCount ?? '—'}</p>
              {org.billingContactName && <p>Billing contact: {org.billingContactName}</p>}
              {org.billingContactEmail && <p>Billing email: {org.billingContactEmail}</p>}
              {org.planNotes && !org.planNotes.startsWith('PROMO:') && <p>Notes: {org.planNotes}</p>}
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
      {/* Organization identity */}
      {org.slug !== 'subhub-platform' && (
        <div className="rounded-lg border border-gray-700 bg-gray-900 p-5 space-y-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Organization Identity</p>
          <form action={updateOrgIdentity} className="space-y-3">
            <input type="hidden" name="orgId" value={org.id} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Organization name</label>
                <input name="name" defaultValue={org.name} required
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">District name <span className="text-gray-600">(optional)</span></label>
                <input name="districtName" defaultValue={org.districtName ?? ''}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
            <button type="submit"
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
              Save
            </button>
          </form>
        </div>
      )}

      {/* Danger Zone */}
      <div className="rounded-lg border border-red-900 bg-gray-900 p-5 space-y-3">
        <p className="text-sm font-semibold text-red-400 uppercase tracking-wider">Danger Zone</p>
        <p className="text-xs text-gray-400">
          Permanently deletes this organization, all its schools, teachers, substitutes, absences,
          assignments, and Supabase auth accounts. This cannot be undone.
        </p>
        <form action={deleteOrganization} className="space-y-3">
          <input type="hidden" name="orgId" value={org.id} />
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Type <span className="text-white font-mono">{org.name}</span> to confirm
            </label>
            <input
              type="text"
              name="confirmName"
              required
              autoComplete="off"
              placeholder={org.name}
              className="w-full rounded-md border border-red-900 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-red-900 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-800 transition-colors"
          >
            Delete {org.name} permanently
          </button>
        </form>
      </div>
    </div>
  )
}
