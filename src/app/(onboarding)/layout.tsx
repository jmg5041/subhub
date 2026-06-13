// Minimal full-screen layout for the onboarding wizard (no sidebar)
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4">
        <span className="text-xl font-bold text-gray-900">SubHub</span>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
    </div>
  )
}
