'use server'

/**
 * Server actions for the substitute portal.
 * Subs can view their assigned jobs and manage their availability calendar.
 */

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, substitutes, subAssignments, subUnavailability } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

async function getSubContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile || profile.role !== 'substitute') throw new Error('Substitute access required')

  const sub = await db.query.substitutes.findFirst({ where: eq(substitutes.userId, user.id) })
  if (!sub) throw new Error('Substitute profile not found')

  return { profile, sub }
}

export async function getMyAssignments() {
  const { sub } = await getSubContext()

  return db.query.subAssignments.findMany({
    where: eq(subAssignments.substituteId, sub.id),
    with: {
      school: true,
      timeOffLinks: {
        with: {
          timeOff: {
            with: {
              employee: { with: { user: true } },
              reason: true,
            },
          },
        },
      },
    },
    orderBy: (a, { desc }) => [desc(a.date)],
  })
}

export async function getMyUnavailableDates(year: number, month: number) {
  const { sub } = await getSubContext()

  // Get all unavailability rows for this sub (we'll filter client-side by month)
  const rows = await db
    .select({ date: subUnavailability.date })
    .from(subUnavailability)
    .where(eq(subUnavailability.substituteId, sub.id))

  return rows.map(r => r.date) // 'YYYY-MM-DD' strings
}

export async function toggleUnavailableDate(date: string) {
  const { sub } = await getSubContext()

  const existing = await db.query.subUnavailability.findFirst({
    where: and(
      eq(subUnavailability.substituteId, sub.id),
      eq(subUnavailability.date, date)
    ),
  })

  if (existing) {
    await db.delete(subUnavailability).where(eq(subUnavailability.id, existing.id))
  } else {
    await db.insert(subUnavailability).values({
      substituteId: sub.id,
      date,
    })
  }

  revalidatePath('/sub/availability')
  return { available: !!existing } // returns new state
}
