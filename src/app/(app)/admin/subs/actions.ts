'use server'

/**
 * Server actions for the admin substitute directory.
 * Admins can see substitutes in their county or any county.
 */

import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, substitutes } from '@/db/schema'
import { eq, asc, sql } from 'drizzle-orm'

async function getAdminOrgContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile || !['admin', 'principal', 'staff'].includes(profile.role)) {
    throw new Error('Admin access required')
  }
  return { orgId: profile.organizationId, userId: user.id }
}

/**
 * Returns all counties that have at least one substitute registered.
 */
export async function getSubCounties() {
  const rows = await db
    .selectDistinct({ county: substitutes.county })
    .from(substitutes)
    .where(sql`${substitutes.county} IS NOT NULL`)
    .orderBy(asc(substitutes.county))
  return rows.map(r => r.county as string)
}

/**
 * Returns all active substitutes, optionally filtered by county.
 * Cross-org: this is intentional — the directory shows all subs in a region.
 */
export async function getSubsByCounty(county: string | null) {
  await getAdminOrgContext()

  const rows = await db.query.substitutes.findMany({
    where: county ? eq(substitutes.county, county) : undefined,
    with: { user: true },
    orderBy: (s, { asc }) => [asc(s.id)],
  })

  // Filter active subs and sort by last name
  return rows
    .filter(s => s.status === 'active')
    .sort((a, b) => a.user.lastName.localeCompare(b.user.lastName))
}
