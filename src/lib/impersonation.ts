import { cookies } from 'next/headers'
import { db } from '@/db'
import { users, organizations } from '@/db/schema'
import { eq } from 'drizzle-orm'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAdminFlags(userId: string) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { organizationId: true, isPlatformAdmin: true },
  })
}

// ─── Org impersonation (admin portal) ─────────────────────────────────────────

async function getImpersonateOrgId(isPlatformAdmin: boolean): Promise<string | null> {
  if (!isPlatformAdmin) return null
  const cookieStore = await cookies()
  return cookieStore.get('impersonate_org_id')?.value ?? null
}

// Returns the org the current user's data queries should run against.
export async function getEffectiveOrgId(userId: string): Promise<string | null> {
  const profile = await getAdminFlags(userId)
  if (!profile) return null
  const impersonateId = await getImpersonateOrgId(profile.isPlatformAdmin ?? false)
  return impersonateId ?? profile.organizationId
}

// Returns the impersonated org's id + name, or null if not impersonating.
export async function getImpersonatedOrg(
  isPlatformAdmin: boolean
): Promise<{ id: string; name: string } | null> {
  const orgId = await getImpersonateOrgId(isPlatformAdmin)
  if (!orgId) return null
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { id: true, name: true },
  })
  return org ?? null
}

// ─── User impersonation (sub / teacher portals) ────────────────────────────────

// Returns the user ID queries should run against for the sub/teacher portals.
// When a platform admin has impersonate_user_id set, returns that ID instead.
export async function getEffectiveUserId(authUserId: string): Promise<string> {
  const profile = await getAdminFlags(authUserId)
  if (!profile?.isPlatformAdmin) return authUserId
  const cookieStore = await cookies()
  return cookieStore.get('impersonate_user_id')?.value ?? authUserId
}

// Returns the impersonated user's display info for the banner, or null if not impersonating.
export async function getImpersonatedUser(authUserId: string): Promise<{
  id: string
  firstName: string
  lastName: string
  role: string
  organizationId: string
} | null> {
  const effectiveId = await getEffectiveUserId(authUserId)
  if (effectiveId === authUserId) return null
  return (await db.query.users.findFirst({
    where: eq(users.id, effectiveId),
    columns: { id: true, firstName: true, lastName: true, role: true, organizationId: true },
  })) ?? null
}
