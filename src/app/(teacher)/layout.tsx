import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, organizations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { TeacherShell } from '@/components/teacher-shell'
import { getBillingState } from '@/lib/billing'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
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

  if (!['teacher'].includes(profile.role)) {
    redirect(profile.role === 'substitute' ? '/sub/dashboard' : '/dashboard')
  }

  const initials = `${profile.firstName[0]}${profile.lastName[0]}`

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, profile.organizationId),
    columns: { subscriptionStatus: true, paidThrough: true },
  })
  const billingState = org ? getBillingState(org) : null
  const isExpired = billingState?.status === 'expired'

  return (
    <TeacherShell
      firstName={profile.firstName}
      lastName={profile.lastName}
      schoolName={profile.school?.name ?? null}
      initials={initials}
      avatarUrl={profile.avatarUrl ?? null}
    >
      {isExpired && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700 text-center">
          Your school&apos;s SubHub subscription has lapsed. Contact your administrator to restore access.
        </div>
      )}
      {children}
    </TeacherShell>
  )
}
