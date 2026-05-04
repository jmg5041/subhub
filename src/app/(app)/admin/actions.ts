'use server'

/**
 * Server Actions for Admin: Manage Users page.
 *
 * Admin-only actions for:
 * - Inviting new teachers, staff, and substitutes via email
 * - Viewing all users in the org
 * - Changing a user's role
 * - Setting a temporary password (manual override when invite email doesn't work)
 * - Resending invite emails
 */

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

  return { users: allUsers, invites: allInvites, schools: allSchools }
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Invites a user via Supabase admin API (sends them an email to set their password).
 * Also records the invitation in our invitations table for tracking.
 */
export async function inviteUser(formData: FormData) {
  const { orgId, adminUserId } = await getAdminContext()
  const supabaseAdmin = createAdminClient()

  const email = formData.get('email') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const role = formData.get('role') as string
  const schoolId = formData.get('schoolId') as string || null

  // Supabase sends the invite email and creates the auth user
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    data: { firstName, lastName, role, orgId, schoolId },
  })

  if (error) {
    return { error: error.message }
  }

  // If no users row exists yet for this email, create a placeholder
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (!existing && data.user) {
    await db.insert(users).values({
      id: data.user.id,
      email,
      firstName,
      lastName,
      role: role as 'admin' | 'principal' | 'staff' | 'teacher' | 'substitute',
      organizationId: orgId,
      schoolId,
    })
  }

  // Record the invitation for tracking
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
 * Resends an invite email for a user.
 */
export async function resendInvite(formData: FormData) {
  const { orgId } = await getAdminContext()
  const supabaseAdmin = createAdminClient()

  const email = formData.get('email') as string
  const role = formData.get('role') as string

  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    data: { role, orgId },
  })

  if (error) return { error: error.message }

  revalidatePath('/admin/users')
  return { success: true }
}

/**
 * Changes a user's role in the org.
 * Only admin/principal can call this.
 */
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

/**
 * Sets a temporary password for a user (manual override when invite email fails).
 * The user will need to change it on first login.
 */
export async function setTempPassword(formData: FormData) {
  const { orgId } = await getAdminContext()
  const supabaseAdmin = createAdminClient()

  const userId = formData.get('userId') as string
  const password = formData.get('password') as string

  // Verify this user belongs to our org before touching their account
  const profile = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!profile || profile.organizationId !== orgId) {
    return { error: 'User not found in your organization' }
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
  if (error) return { error: error.message }

  return { success: true }
}

/**
 * Deactivates a user (sets status to inactive, doesn't delete).
 */
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
