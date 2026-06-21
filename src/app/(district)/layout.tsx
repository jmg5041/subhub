import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users, organizations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'

export default async function DistrictLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { role: true, firstName: true, lastName: true, organizationId: true },
  })

  if (!profile || profile.role !== 'district') redirect('/auth/login')

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, profile.organizationId),
    columns: { name: true, districtName: true },
  })

  const displayName = org?.districtName || org?.name || 'District'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">District Portal</p>
          <p className="text-sm font-semibold text-gray-900">{displayName}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{profile.firstName} {profile.lastName}</span>
          <form action="/auth/signout" method="POST">
            <button type="submit" className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
          </form>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
