'use server'

/**
 * Server Actions for the Settings page.
 *
 * Handles:
 * - Loading the org's current notification preferences
 * - Saving notification toggle settings (auto-notify, channels)
 * - Loading and saving the sub priority order (which subs to contact first)
 */

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { organizations, users, substitutes, subPriorityOrders } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getEffectiveOrgId } from '@/lib/impersonation'

// ─── Auth Helper ──────────────────────────────────────────────────────────────

async function getOrgId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const orgId = await getEffectiveOrgId(user.id)
  if (!orgId) throw new Error('User profile not found')

  return orgId
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/**
 * Loads the org's notification settings and the full sub list with priority ranks.
 */
export async function getOrgSettings() {
  const orgId = await getOrgId()

  const [org, priorityRows, allSubs] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    }),
    db
      .select()
      .from(subPriorityOrders)
      .where(eq(subPriorityOrders.organizationId, orgId))
      .orderBy(asc(subPriorityOrders.priorityRank)),
    db
      .select({
        id: substitutes.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(substitutes)
      .innerJoin(users, eq(substitutes.userId, users.id))
      .where(eq(users.organizationId, orgId))
      .orderBy(asc(users.lastName), asc(users.firstName)),
  ])

  // Merge priority rank into sub list
  const rankMap = new Map(priorityRows.map(r => [r.substituteId, r.priorityRank]))
  const subsWithRank = allSubs
    .map(s => ({ ...s, priorityRank: rankMap.get(s.id) ?? 999 }))
    .sort((a, b) => a.priorityRank - b.priorityRank || a.lastName.localeCompare(b.lastName))

  return { org, subs: subsWithRank }
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Saves notification channel and auto-notify preferences for the org.
 */
export async function saveOrgIdentity(formData: FormData) {
  const orgId = await getOrgId()
  const name = (formData.get('name') as string).trim()
  const districtName = (formData.get('districtName') as string).trim() || null

  if (!name) return

  await db.update(organizations)
    .set({ name, districtName, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))

  revalidatePath('/settings')
}

export async function saveOrgSettings(formData: FormData) {
  const orgId = await getOrgId()

  const halfDay = parseFloat(formData.get('halfDayHours') as string)
  const fullDay = parseFloat(formData.get('fullDayHours') as string)

  await db
    .update(organizations)
    .set({
      autoNotifySubs: formData.get('autoNotifySubs') === 'true',
      notifyByEmail: formData.get('notifyByEmail') === 'true',
      notifyBySms: formData.get('notifyBySms') === 'true',
      notifyByPhone: formData.get('notifyByPhone') === 'true',
      subPayModel: (formData.get('subPayModel') as string) || 'block',
      halfDayHours: isNaN(halfDay) ? '4.0' : halfDay.toFixed(1),
      fullDayHours: isNaN(fullDay) ? '8.0' : fullDay.toFixed(1),
      timezone: (formData.get('timezone') as string) || 'America/Los_Angeles',
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId))

  revalidatePath('/settings')
}

/**
 * Saves the sub priority order. Receives an ordered array of sub IDs.
 * Deletes old ranks and inserts fresh ones — simpler than upsert for this use case.
 */
export async function saveSubPriorityOrder(orderedSubIds: string[]) {
  const orgId = await getOrgId()

  // Delete all existing ranks for this org, then insert fresh
  await db
    .delete(subPriorityOrders)
    .where(eq(subPriorityOrders.organizationId, orgId))

  if (orderedSubIds.length > 0) {
    await db.insert(subPriorityOrders).values(
      orderedSubIds.map((substituteId, index) => ({
        organizationId: orgId,
        substituteId,
        priorityRank: index + 1,
      }))
    )
  }

  revalidatePath('/settings')
  return { success: true }
}
