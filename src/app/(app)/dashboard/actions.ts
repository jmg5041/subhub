'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function dismissChecklistAction(formData: FormData) {
  const orgId = formData.get('orgId') as string
  if (!orgId) return

  const cookieStore = await cookies()
  // Scoped per org so it works correctly if admin switches orgs
  cookieStore.set(`checklist_dismissed_${orgId}`, '1', {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
  })

  redirect('/dashboard')
}
