import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getMyProfile } from '../../actions'
import { GetHiredClient } from './GetHiredClient'

export default async function GetHiredPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { profile, sub } = await getMyProfile()

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Get Hired</h1>
        <p className="text-gray-500 mt-1">
          Let schools in your area find and contact you for substitute work.
        </p>
      </div>

      <GetHiredClient
        firstName={profile.firstName}
        lastName={profile.lastName}
        avatarUrl={profile.avatarUrl ?? null}
        county={sub.county ?? null}
        visibleInDirectory={sub.visibleInDirectory}
        resumeUrl={sub.resumeUrl ?? null}
        rating={sub.rating ? Number(sub.rating) : null}
        ratingCount={sub.ratingCount ?? 0}
      />
    </div>
  )
}
