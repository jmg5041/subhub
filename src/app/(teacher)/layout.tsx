import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { TeacherShell } from '@/components/teacher-shell'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    with: { school: true },
  })

  if (!profile) redirect('/auth/login')

  if (!['teacher'].includes(profile.role)) {
    redirect(profile.role === 'substitute' ? '/sub/dashboard' : '/dashboard')
  }

  const initials = `${profile.firstName[0]}${profile.lastName[0]}`

  return (
    <TeacherShell
      firstName={profile.firstName}
      lastName={profile.lastName}
      schoolName={profile.school?.name ?? null}
      initials={initials}
    >
      {children}
    </TeacherShell>
  )
}
