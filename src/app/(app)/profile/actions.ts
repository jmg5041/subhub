'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, schools, userSchoolNotificationPrefs } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
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

export async function saveAdminProfile(data: {
  firstName: string
  lastName: string
  phone: string
}) {
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

export type SchoolPref = {
  schoolId: string
  schoolName: string
  alertOnTeacherSubmit: boolean
  alertOnUnfilled: boolean
}

export async function getSchoolPrefs(): Promise<SchoolPref[]> {
  const me = await getMe()

  const orgSchools = await db
    .select({ id: schools.id, name: schools.name })
    .from(schools)
    .where(eq(schools.organizationId, me.organizationId))
    .orderBy(asc(schools.name))

  const existingPrefs = await db
    .select()
    .from(userSchoolNotificationPrefs)
    .where(eq(userSchoolNotificationPrefs.userId, me.id))

  const prefMap = new Map(existingPrefs.map(p => [p.schoolId, p]))

  return orgSchools.map(school => ({
    schoolId: school.id,
    schoolName: school.name,
    alertOnTeacherSubmit: prefMap.get(school.id)?.alertOnTeacherSubmit ?? true,
    alertOnUnfilled: prefMap.get(school.id)?.alertOnUnfilled ?? true,
  }))
}

export async function saveNotificationPrefs(
  prefs: { schoolId: string; alertOnTeacherSubmit: boolean; alertOnUnfilled: boolean }[]
) {
  const me = await getMe()

  await db
    .delete(userSchoolNotificationPrefs)
    .where(eq(userSchoolNotificationPrefs.userId, me.id))

  if (prefs.length > 0) {
    await db.insert(userSchoolNotificationPrefs).values(
      prefs.map(p => ({
        userId: me.id,
        schoolId: p.schoolId,
        alertOnTeacherSubmit: p.alertOnTeacherSubmit,
        alertOnUnfilled: p.alertOnUnfilled,
      }))
    )
  }

  revalidatePath('/profile')
  return { success: true }
}
