'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

async function assertPlatformAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { isPlatformAdmin: true },
  })
  if (!profile?.isPlatformAdmin) redirect('/platform')
}

export async function setImpersonation(formData: FormData) {
  await assertPlatformAdmin()

  const orgId = formData.get('orgId') as string
  if (!orgId) redirect('/platform')

  const cookieStore = await cookies()
  cookieStore.set('impersonate_org_id', orgId, { httpOnly: true, sameSite: 'lax', path: '/' })

  redirect('/dashboard')
}

export async function clearImpersonation() {
  const cookieStore = await cookies()
  cookieStore.delete('impersonate_org_id')
  redirect('/platform')
}

// ─── User impersonation (sub / teacher portals) ───────────────────────────────

export async function setUserImpersonation(formData: FormData) {
  await assertPlatformAdmin()

  const userId     = formData.get('userId') as string
  const redirectTo = (formData.get('redirectTo') as string) || '/sub/dashboard'

  const cookieStore = await cookies()
  cookieStore.set('impersonate_user_id', userId, { httpOnly: true, sameSite: 'lax', path: '/' })
  cookieStore.delete('impersonate_org_id') // clear org impersonation — mutually exclusive

  redirect(redirectTo)
}

export async function clearUserImpersonation() {
  const cookieStore = await cookies()
  cookieStore.delete('impersonate_user_id')
  redirect('/platform')
}
