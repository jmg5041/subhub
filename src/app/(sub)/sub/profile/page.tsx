import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users, substitutes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ProfileForm } from './ProfileForm'
import { getDirectoryCounties } from '../../actions'
import { getEffectiveUserId } from '@/lib/impersonation'

export default async function SubProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const effectiveUserId = await getEffectiveUserId(user.id)

  const [profile, sub, counties] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, effectiveUserId) }),
    db.query.substitutes.findFirst({ where: eq(substitutes.userId, effectiveUserId) }),
    getDirectoryCounties(),
  ])

  if (!profile || !sub) redirect('/sub/dashboard')

  return (
    <div className="max-w-lg mx-auto py-6 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-1">
          Update your contact info and your county so we can match you with schools near you.
        </p>
      </div>

      <ProfileForm
        userId={profile.id}
        firstName={profile.firstName}
        lastName={profile.lastName}
        email={profile.email}
        phone={profile.phone ?? ''}
        county={sub.county ?? ''}
        counties={counties}
        avatarUrl={profile.avatarUrl ?? null}
        resumeUrl={sub.resumeUrl ?? null}
        visibleInDirectory={sub.visibleInDirectory}
      />
    </div>
  )
}
