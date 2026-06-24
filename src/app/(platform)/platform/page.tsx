import { db } from '@/db'
import { organizations, schools, users, platformSettings } from '@/db/schema'
import { eq, count, sql } from 'drizzle-orm'
import { getBillingState } from '@/lib/billing'
import Link from 'next/link'
import { getPlatformContext, saveStaffAlertEmail, saveBranding, savePricing } from './actions'

const STATUS_COLORS: Record<string, string> = {
  active:        'bg-green-100 text-green-700',
  trial:         'bg-blue-100 text-blue-700',
  trial_ending:  'bg-amber-100 text-amber-700',
  past_due:      'bg-orange-100 text-orange-700',
  expired:       'bg-red-100 text-red-700',
}

type OrgRow = Awaited<ReturnType<typeof import('@/db').db.query.organizations.findMany>>[0]

function getStage(org: OrgRow, schoolCount: number): { label: string; color: string } {
  if (org.subscriptionStatus === 'active')   return { label: 'Paid',       color: 'bg-green-100 text-green-700' }
  if (org.subscriptionStatus === 'past_due') return { label: 'Due',        color: 'bg-orange-100 text-orange-700' }
  if (org.subscriptionStatus === 'expired')  return { label: 'Expired',    color: 'bg-red-100 text-red-700' }
  if (org.onboardingCompletedAt)             return { label: 'Signed up',  color: 'bg-blue-100 text-blue-700' }
  return                                            { label: 'Onboarding', color: 'bg-amber-100 text-amber-700' }
}

// suppress unused warning — schoolCount kept for future sub-stage detection
void ((_: number) => _)

function daysSince(date: Date | string | null): number | null {
  if (!date) return null
  const ms = Date.now() - new Date(date).getTime()
  return Math.floor(ms / 86_400_000)
}

export default async function PlatformPage() {
  const { adminUserId } = await getPlatformContext()

  const settings = await db.query.platformSettings.findFirst()

  const allOrgs = await db.query.organizations.findMany({
    orderBy: (o, { desc }) => [desc(o.createdAt)],
  })

  const platformOrg = allOrgs.find(o => o.slug === 'subhub-platform')
  const schoolOrgs  = allOrgs.filter(o => o.slug !== 'subhub-platform')

  // Counts per org
  const [schoolCounts, userCounts, platformStaff] = await Promise.all([
    db.select({ orgId: schools.organizationId, count: count() })
      .from(schools)
      .groupBy(schools.organizationId),
    db.select({ orgId: users.organizationId, count: count() })
      .from(users)
      .groupBy(users.organizationId),
    platformOrg
      ? db.query.users.findMany({
          where: eq(users.organizationId, platformOrg.id),
          columns: { id: true, firstName: true, lastName: true, email: true },
        })
      : Promise.resolve([]),
  ])

  // Count platform staff with active (unexpired) sessions
  let onlineCount = 0
  if (platformStaff.length > 0) {
    try {
      const staffIds = platformStaff.map(u => u.id)
      const result = await db.execute(sql`
        SELECT COUNT(DISTINCT user_id) as cnt
        FROM auth.sessions
        WHERE not_after > now()
        AND user_id = ANY(ARRAY[${sql.join(staffIds.map(id => sql`${id}::uuid`), sql`, `)}])
      `)
      onlineCount = Number((result[0] as { cnt: unknown })?.cnt ?? 0)
    } catch {
      // auth.sessions inaccessible — omit count
    }
  }

  // Current logged-in user's profile (to show their name in the strip)
  const currentUser = platformStaff.find(u => u.id === adminUserId)

  const schoolMap = new Map(schoolCounts.map(r => [r.orgId, r.count]))
  const userMap   = new Map(userCounts.map(r => [r.orgId, r.count]))

  return (
    <div className="space-y-6">
      {/* IT Staff strip — shows logged-in user and online count */}
      {platformOrg && (
        <div className="rounded-lg border border-indigo-800 bg-indigo-950/40 px-5 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-indigo-400 uppercase tracking-wider mb-0.5">IT Staff</p>
            {currentUser && (
              <span className="text-sm text-white">
                {currentUser.firstName} {currentUser.lastName}{' '}
                <span className="text-indigo-400 text-xs">({currentUser.email})</span>
              </span>
            )}
          </div>
          {onlineCount > 0 && (
            <p className="text-xs text-indigo-300 uppercase tracking-widest font-semibold">
              IT Staff Online: {onlineCount}
            </p>
          )}
        </div>
      )}

      {/* Platform nav */}
      <div className="flex items-center gap-6 text-sm border-b border-gray-800 pb-3">
        {platformOrg && (
          <Link href={`/platform/${platformOrg.id}`} className="text-indigo-400 hover:text-indigo-200">
            IT Staff
          </Link>
        )}
        <Link href="/platform/emails" className="text-indigo-400 hover:text-indigo-200">
          Email Reference
        </Link>
        <Link href="/platform/onboarding" className="text-indigo-400 hover:text-indigo-200">
          Onboarding Guide
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">All Organizations</h1>
          <p className="text-gray-400 text-sm mt-1">{schoolOrgs.length} orgs total</p>
        </div>

        {/* Platform settings */}
        <div className="space-y-3 w-80">
          {/* Staff alert email */}
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Staff Alert Email</p>
            <p className="text-xs text-gray-500 mb-3">Billing expiry alerts are sent here.</p>
            <form action={saveStaffAlertEmail} className="flex gap-2">
              <input type="email" name="staffAlertEmail"
                defaultValue={settings?.staffAlertEmail ?? ''}
                placeholder="you@example.com"
                className="flex-1 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
              <button type="submit"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
                Save
              </button>
            </form>
          </div>

          {/* Pricing */}
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Seat Pricing</p>
            <p className="text-xs text-gray-500 mb-3">
              Changing the price here updates display and emails only. Also update the Stripe price ID when you create a new price in Stripe.
            </p>
            <form action={savePricing} className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Price per seat / month ($)</label>
                <input type="number" name="pricePerSeat" step="0.01" min="1"
                  defaultValue={((settings?.pricePerSeatCents ?? 800) / 100).toFixed(2)}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Stripe Price ID</label>
                <input type="text" name="stripePriceId"
                  defaultValue={settings?.stripePriceId ?? ''}
                  placeholder="price_..."
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
              </div>
              <button type="submit"
                className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
                Save pricing
              </button>
            </form>
          </div>

          {/* Branding */}
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Branding</p>
            <form action={saveBranding} className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">App name</label>
                <input type="text" name="appName"
                  defaultValue={settings?.appName ?? 'SubHub'}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Logo URL <span className="text-gray-600">(optional)</span></label>
                <input type="url" name="logoUrl"
                  defaultValue={settings?.logoUrl ?? ''}
                  placeholder="https://..."
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
              </div>
              <button type="submit"
                className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
                Save branding
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Organization</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-left">Stage</th>
              <th className="px-4 py-3 text-center">Schools</th>
              <th className="px-4 py-3 text-center">Users</th>
              <th className="px-4 py-3 text-left">Billing</th>
              <th className="px-4 py-3 text-left">Paid through</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {schoolOrgs.map(org => {
              const state = getBillingState(org)
              const statusLabel =
                state.status === 'trial_ending' ? `Trial (${state.daysLeft}d left)` :
                state.status === 'trial'         ? `Trial (${state.daysLeft}d left)` :
                state.status
              const schoolCount = schoolMap.get(org.id) ?? 0
              const stage = getStage(org, schoolCount)
              const stuck = !org.onboardingCompletedAt ? daysSince(org.createdAt) : null
              return (
                <tr key={org.id} className="bg-gray-900 hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{org.name}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${stage.color}`}>
                      {stage.label}
                    </span>
                    {stuck !== null && stuck > 2 && (
                      <span className="ml-1.5 text-xs text-gray-500">{stuck}d</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">{schoolCount}</td>
                  <td className="px-4 py-3 text-center text-gray-300">{userMap.get(org.id) ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[state.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{org.paidThrough ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/platform/${org.id}`} className="text-indigo-400 hover:text-indigo-200 text-xs">
                      Manage →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
