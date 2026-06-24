'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getEffectiveOrgId } from '@/lib/impersonation'
import { commitSeatUpdate } from '@/lib/seat-management'

async function getOrgId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const orgId = await getEffectiveOrgId(user.id)
  if (!orgId) throw new Error('Org not found')
  return orgId
}

export async function commitSeatUpdateAction(formData: FormData) {
  const orgId = await getOrgId()
  const overrideCount = formData.get('seatCount') ? parseInt(formData.get('seatCount') as string, 10) : undefined
  await commitSeatUpdate(orgId, overrideCount && !isNaN(overrideCount) ? overrideCount : undefined)
  revalidatePath('/billing')
}
