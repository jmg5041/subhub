'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/db'
import { users, schools, invitations } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAdminContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile) throw new Error('User profile not found')
  if (!['admin', 'principal'].includes(profile.role)) throw new Error('Admin access required')

  return { orgId: profile.organizationId, adminUserId: user.id }
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getOrgUsers() {
  const { orgId } = await getAdminContext()

  const [allUsers, allInvites, allSchools] = await Promise.all([
    db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        status: users.status,
        schoolId: users.schoolId,
      })
      .from(users)
      .where(eq(users.organizationId, orgId))
      .orderBy(users.lastName, users.firstName),

    db
      .select()
      .from(invitations)
      .where(eq(invitations.organizationId, orgId))
      .orderBy(desc(invitations.createdAt)),

    db
      .select({ id: schools.id, name: schools.name })
      .from(schools)
      .where(eq(schools.organizationId, orgId))
      .orderBy(schools.name),
  ])

  // Only show users who have accepted their invite (not pending ones)
  // Pending users are shown in the Invitations section instead
  const pendingEmails = new Set(
    allInvites.filter(i => !i.usedAt).map(i => i.email)
  )
  const acceptedUsers = allUsers.filter(u => !pendingEmails.has(u.email ?? ''))

  return { users: acceptedUsers, invites: allInvites, schools: allSchools }
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Invites a user via Supabase admin API (sends them the invite email).
 * Does NOT pre-create a users row — that happens in /auth/callback when they accept.
 */
export async function inviteUser(formData: FormData) {
  const { orgId, adminUserId } = await getAdminContext()
  const supabaseAdmin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

  const email = formData.get('email') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const role = formData.get('role') as string
  const schoolId = formData.get('schoolId') as string || null

  // Supabase sends the invite email and creates the auth user
  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/auth/callback`,
    data: { firstName, lastName, role, orgId, schoolId },
  })

  if (error) {
    return { error: error.message }
  }

  // Record the invitation for tracking (used to create the users row on accept)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await db.insert(invitations).values({
    organizationId: orgId,
    schoolId,
    email,
    role: role as 'admin' | 'principal' | 'staff' | 'teacher' | 'substitute',
    invitedBy: adminUserId,
    expiresAt,
  })

  revalidatePath('/admin/users')
  return { success: true }
}

/**
 * Resends an invite by deleting the old Supabase auth user and re-inviting fresh.
 * This uses the same reliable PKCE flow as the original invite (goes to /auth/callback).
 * Recovery links were unreliable because each generateLink call invalidates previous OTPs.
 */
export async function resendInvite(formData: FormData) {
  const { orgId } = await getAdminContext()
  const supabaseAdmin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

  const email = formData.get('email') as string
  const role = formData.get('role') as string

  // Find the existing Supabase auth user so we can read their metadata before deleting
  const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  const existingAuthUser = authUsers.find(u => u.email === email)

  // Preserve name/school metadata from the original invite
  const meta = existingAuthUser?.user_metadata ?? {}
  const firstName = (meta.firstName as string) || ''
  const lastName = (meta.lastName as string) || ''
  const schoolId = (meta.schoolId as string) || null

  // Delete the old auth user so inviteUserByEmail can issue a fresh PKCE invite
  if (existingAuthUser) {
    await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id)
  }

  // Re-invite: Supabase creates a fresh auth user and sends the invite email
  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/auth/callback`,
    data: { firstName, lastName, role, orgId, schoolId },
  })

  if (error) return { error: error.message }

  // Reset the invitation expiry in our tracking table
  await db
    .update(invitations)
    .set({ expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) })
    .where(eq(invitations.email, email))

  revalidatePath('/admin/users')
  return { success: true }
}

export async function updateUserRole(formData: FormData) {
  const { orgId } = await getAdminContext()

  const userId = formData.get('userId') as string
  const role = formData.get('role') as string

  await db
    .update(users)
    .set({ role: role as 'admin' | 'principal' | 'staff' | 'teacher' | 'substitute' })
    .where(eq(users.id, userId))

  revalidatePath('/admin/users')
  return { success: true }
}

export async function setTempPassword(formData: FormData) {
  const { orgId } = await getAdminContext()
  const supabaseAdmin = createAdminClient()

  const userId = formData.get('userId') as string
  const password = formData.get('password') as string

  const profile = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!profile || profile.organizationId !== orgId) {
    return { error: 'User not found in your organization' }
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
  if (error) return { error: error.message }

  return { success: true }
}

export async function deactivateUser(formData: FormData) {
  const { orgId } = await getAdminContext()

  const userId = formData.get('userId') as string

  await db
    .update(users)
    .set({ status: 'inactive' })
    .where(eq(users.id, userId))

  revalidatePath('/admin/users')
  return { success: true }
}

export async function reactivateUser(formData: FormData) {
  const { orgId } = await getAdminContext()

  const userId = formData.get('userId') as string

  const profile = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!profile || profile.organizationId !== orgId) {
    return { error: 'User not found in your organization' }
  }

  await db
    .update(users)
    .set({ status: 'active' })
    .where(eq(users.id, userId))

  revalidatePath('/admin/users')
  return { success: true }
}
