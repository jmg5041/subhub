import { db } from '@/db'
import { organizations, schools, users } from '@/db/schema'
import { eq, count } from 'drizzle-orm'
import { getBillingState } from '@/lib/billing'
import Link from 'next/link'
import { getPlatformContext } from './actions'

const STATUS_COLORS: Record<string, string> = {
  active:        'bg-green-100 text-green-700',
  trial:         'bg-blue-100 text-blue-700',
  trial_ending:  'bg-amber-100 text-amber-700',
  past_due:      'bg-orange-100 text-orange-700',
  expired:       'bg-red-100 text-red-700',
}

export default async function PlatformPage() {
  await getPlatformContext()

  const allOrgs = await db.query.organizations.findMany({
    orderBy: (o, { desc }) => [desc(o.createdAt)],
  })

  // Counts per org
  const [schoolCounts, userCounts] = await Promise.all([
    db.select({ orgId: schools.organizationId, count: count() })
      .from(schools)
      .groupBy(schools.organizationId),
    db.select({ orgId: users.organizationId, count: count() })
      .from(users)
      .groupBy(users.organizationId),
  ])

  const schoolMap = new Map(schoolCounts.map(r => [r.orgId, r.count]))
  const userMap   = new Map(userCounts.map(r => [r.orgId, r.count]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">All Organizations</h1>
        <p className="text-gray-400 text-sm mt-1">{allOrgs.length} orgs total</p>
      </div>

      <div className="rounded-lg overflow-hidden border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Organization</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-center">Schools</th>
              <th className="px-4 py-3 text-center">Users</th>
              <th className="px-4 py-3 text-left">Billing</th>
              <th className="px-4 py-3 text-left">Paid through</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {allOrgs.map(org => {
              const state = getBillingState(org)
              const statusLabel =
                state.status === 'trial_ending' ? `Trial (${state.daysLeft}d left)` :
                state.status === 'trial'         ? `Trial (${state.daysLeft}d left)` :
                state.status
              return (
                <tr key={org.id} className="bg-gray-900 hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{org.name}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">{schoolMap.get(org.id) ?? 0}</td>
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
