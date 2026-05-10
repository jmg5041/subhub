'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

async function getMe() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile) throw new Error('User not found')
  return profile
}

export async function getAdminProfile() {
  return getMe()
}

export async function saveAdminProfile(data: { firstName: string; lastName: string; phone: string }) {
  const me = await getMe()
  await db.update(users).set({
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    phone: data.phone.trim() || null,
  }).where(eq(users.id, me.id))
  revalidatePath('/profile')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function saveAdminAvatar(url: string) {
  const me = await getMe()
  await db.update(users).set({ avatarUrl: url }).where(eq(users.id, me.id))
  revalidatePath('/profile')
}
