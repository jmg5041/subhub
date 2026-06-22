import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { PlatformSignOut } from '@/components/PlatformSignOut'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { isPlatformAdmin: true, firstName: true },
  })

  if (!profile?.isPlatformAdmin) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-indigo-400" />
          <span className="text-lg font-bold text-white">SubHub Platform</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-gray-400 hover:text-white">← Back to app</Link>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400">{profile.firstName}</span>
          <span className="text-gray-600">|</span>
          <PlatformSignOut />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
