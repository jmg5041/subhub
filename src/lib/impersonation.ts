import { cookies } from 'next/headers'
import { db } from '@/db'
import { users, organizations } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Returns the org ID a platform admin is currently impersonating, or null.
async function getImpersonateOrgId(isPlatformAdmin: boolean): Promise<string | null> {
  if (!isPlatformAdmin) return null
  const cookieStore = await cookies()
  return cookieStore.get('impersonate_org_id')?.value ?? null
}

// Returns the org the current user's data queries should run against.
// For platform admins with an active impersonation cookie, returns the impersonated org.
// For everyone else, returns their own org.
export async function getEffectiveOrgId(userId: string): Promise<string | null> {
  const profile = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { organizationId: true, isPlatformAdmin: true },
  })
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
