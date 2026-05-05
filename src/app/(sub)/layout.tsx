import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { SubShell } from '@/components/sub-shell'

export default async function SubLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    with: { school: true },
  })

  if (!profile) redirect('/auth/login')

  if (profile.role !== 'substitute') {
    redirect(profile.role === 'teacher' ? '/teacher' : '/dashboard')
  }

  const initials = `${profile.firstName[0]}${profile.lastName[0]}`

  return (
    <SubShell
      firstName={profile.firstName}
      lastName={profile.lastName}
      initials={initials}
    >
      {children}
    </SubShell>
  )
}
