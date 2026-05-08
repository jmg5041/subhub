'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/db'
import { users, schools, invitations, employees, substitutes, subAssignments, assignmentTimeOff, subNotificationTokens, subPriorityOrders, subUnavailability, teacherTimeOff } from '@/db/schema'
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
        phone: users.phone,
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

export async function updateUser(formData: FormData) {
  const { orgId } = await getAdminContext()
  const supabaseAdmin = createAdminClient()

  const userId = formData.get('userId') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const email = formData.get('email') as string
  const phone = (formData.get('phone') as string) || null

  const existing = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!existing || existing.organizationId !== orgId) return { error: 'User not found' }

  await db.update(users).set({ firstName, lastName, email, phone }).where(eq(users.id, userId))

  // Keep Supabase auth email in sync if it changed
  if (email !== existing.email) {
    await supabaseAdmin.auth.admin.updateUserById(userId, { email })
  }

  revalidatePath('/admin/users')
  return { success: true }
}

export async function deleteUser(formData: FormData) {
  const { orgId } = await getAdminContext()
  const supabaseAdmin = createAdminClient()

  const userId = formData.get('userId') as string

  const existing = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!existing || existing.organizationId !== orgId) return { error: 'User not found' }

  // Delete substitute-related rows in FK-safe order
  const sub = await db.query.substitutes.findFirst({ where: eq(substitutes.userId, userId) })
  if (sub) {
    // Get all assignment IDs for this sub
    const assignments = await db.select({ id: subAssignments.id }).from(subAssignments).where(eq(subAssignments.substituteId, sub.id))
    const assignmentIds = assignments.map(a => a.id)
    if (assignmentIds.length > 0) {
      for (const aId of assignmentIds) {
        await db.delete(assignmentTimeOff).where(eq(assignmentTimeOff.assignmentId, aId))
      }
      for (const aId of assignmentIds) {
        await db.delete(subAssignments).where(eq(subAssignments.id, aId))
      }
    }
    await db.delete(subNotificationTokens).where(eq(subNotificationTokens.substituteId, sub.id))
    await db.delete(subPriorityOrders).where(eq(subPriorityOrders.substituteId, sub.id))
    await db.delete(subUnavailability).where(eq(subUnavailability.substituteId, sub.id))
    await db.delete(substitutes).where(eq(substitutes.id, sub.id))
  }

  // Delete employee-related rows in FK-safe order
  const employee = await db.query.employees.findFirst({ where: eq(employees.userId, userId) })
  if (employee) {
    const timeOffRows = await db.select({ id: teacherTimeOff.id }).from(teacherTimeOff).where(eq(teacherTimeOff.employeeId, employee.id))
    for (const row of timeOffRows) {
      await db.delete(assignmentTimeOff).where(eq(assignmentTimeOff.timeOffId, row.id))
      await db.delete(subNotificationTokens).where(eq(subNotificationTokens.teacherTimeOffId, row.id))
      await db.delete(teacherTimeOff).where(eq(teacherTimeOff.id, row.id))
    }
    await db.delete(employees).where(eq(employees.id, employee.id))
  }

  // Delete the users row, then remove from Supabase auth
  await db.delete(users).where(eq(users.id, userId))
  await supabaseAdmin.auth.admin.deleteUser(userId)

  revalidatePath('/admin/users')
  return { success: true }
}

// ─── School management ────────────────────────────────────────────────────────

export async function getOrgSchools() {
  const { orgId } = await getAdminContext()
  return db.query.schools.findMany({
    where: eq(schools.organizationId, orgId),
    orderBy: (s, { asc }) => [asc(s.name)],
  })
}

export async function updateSchool(formData: FormData) {
  const { orgId } = await getAdminContext()
  const id = formData.get('id') as string

  const school = await db.query.schools.findFirst({
    where: eq(schools.id, id),
  })
  if (!school || school.organizationId !== orgId) {
    return { error: 'School not found' }
  }

  await db
    .update(schools)
    .set({
      name:         (formData.get('name') as string).trim(),
      address:      (formData.get('address') as string).trim() || null,
      city:         (formData.get('city') as string).trim() || null,
      state:        (formData.get('state') as string).trim() || null,
      zip:          (formData.get('zip') as string).trim() || null,
      phone:        (formData.get('phone') as string).trim() || null,
      website:      (formData.get('website') as string).trim() || null,
      dayStartTime: (formData.get('dayStartTime') as string) || school.dayStartTime,
      dayEndTime:   (formData.get('dayEndTime') as string) || school.dayEndTime,
      updatedAt:    new Date(),
    })
    .where(eq(schools.id, id))

  revalidatePath('/admin/schools')
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
