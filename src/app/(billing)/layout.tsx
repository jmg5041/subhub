// Minimal layout for billing pages — intentionally outside (app) to avoid
// redirect loops when expired orgs are sent here from the app layout gate.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function BillingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4 flex items-center gap-3">
        <span className="text-xl font-bold text-gray-900">SubHub</span>
        <span className="text-gray-300">·</span>
        <span className="text-sm text-gray-500">Billing</span>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10">{children}</main>
    </div>
  )
}
