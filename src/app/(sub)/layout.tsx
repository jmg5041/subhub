import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, organizations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { SubShell } from '@/components/sub-shell'
import { getBillingState } from '@/lib/billing'
import { UserImpersonationBanner } from '@/components/UserImpersonationBanner'
import { getImpersonatedUser } from '@/lib/impersonation'

export default async function SubLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    with: { school: true },
  })

  if (!profile) {
    await supabase.auth.signOut()
    redirect('/auth/login')
  }

  const isPlatformAdmin = profile.isPlatformAdmin ?? false

  // Platform admin: load the impersonated sub's profile instead
  let displayProfile = profile
  let impersonatedUser: { firstName: string; lastName: string; role: string } | null = null

  if (isPlatformAdmin) {
    const imp = await getImpersonatedUser(user.id)
    if (!imp || imp.role !== 'substitute') redirect('/platform')
    const impProfile = await db.query.users.findFirst({
      where: eq(users.id, imp.id),
      with: { school: true },
    })
    if (!impProfile) redirect('/platform')
    displayProfile = impProfile
    impersonatedUser = imp
  } else if (profile.role !== 'substitute') {
    redirect(profile.role === 'teacher' ? '/teacher' : '/dashboard')
  }

  const initials = `${displayProfile.firstName[0]}${displayProfile.lastName[0]}`

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, displayProfile.organizationId),
    columns: { subscriptionStatus: true, paidThrough: true },
  })
  const billingState = org ? getBillingState(org) : null
  const isExpired = billingState?.status === 'expired'

  return (
    <SubShell
      firstName={displayProfile.firstName}
      lastName={displayProfile.lastName}
      initials={initials}
      avatarUrl={displayProfile.avatarUrl ?? null}
    >
      {impersonatedUser && (
        <UserImpersonationBanner
          firstName={impersonatedUser.firstName}
          lastName={impersonatedUser.lastName}
          role={impersonatedUser.role}
        />
      )}
      {isExpired && !isPlatformAdmin && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700 text-center">
          This school&apos;s SubHub subscription has lapsed. Contact the school administrator.
        </div>
      )}
      {children}
    </SubShell>
  )
}
