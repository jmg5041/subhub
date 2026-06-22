'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/db'
import { users, schools, invitations, employees, substitutes, subAssignments, assignmentTimeOff, subNotificationTokens, subPriorityOrders, subUnavailability, teacherTimeOff, schoolDirectory, subSchoolAssignments } from '@/db/schema'
import { eq, desc, ilike, or, and, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getEffectiveOrgId } from '@/lib/impersonation'

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAdminContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile) throw new Error('User profile not found')
  if (!['admin', 'principal'].includes(profile.role) && !profile.isPlatformAdmin) throw new Error('Admin access required')

  const orgId = await getEffectiveOrgId(user.id)
  if (!orgId) throw new Error('Org not found')

  return { orgId, adminUserId: user.id }
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getOrgUsers() {
  const { orgId } = await getAdminContext()

  const [allUsers, allInvites, allSchools, allEmployees] = await Promise.all([
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
        avatarUrl: users.avatarUrl,
        emailBounced: users.emailBounced,
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

    // Load all employee→school assignments so multi-school teachers show all their schools
    db
      .select({ userId: employees.userId, schoolId: employees.schoolId })
      .from(employees)
      .innerJoin(users, eq(employees.userId, users.id))
      .where(eq(users.organizationId, orgId)),
  ])

  // Group employee school assignments by userId
  const schoolIdsByUser = new Map<string, string[]>()
  for (const emp of allEmployees) {
    const existing = schoolIdsByUser.get(emp.userId) ?? []
    existing.push(emp.schoolId)
    schoolIdsByUser.set(emp.userId, existing)
  }

  // Only show users who have accepted their invite (not pending ones)
  // Pending users are shown in the Invitations section instead
  const pendingEmails = new Set(
    allInvites.filter(i => !i.usedAt).map(i => i.email)
  )
  const acceptedUsers = allUsers
    .filter(u => !pendingEmails.has(u.email ?? ''))
    .map(u => ({ ...u, schoolIds: schoolIdsByUser.get(u.id) ?? [] }))

  return { users: acceptedUsers, invites: allInvites, schools: allSchools }
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Invites a user via Supabase admin API (sends them the invite email).
 * Does NOT pre-create a users row — that happens in /auth/portal when they accept.
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
    redirectTo: `${appUrl}/auth/confirm`,
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
 * Invite links use implicit flow (hash token) — must redirect to /auth/confirm, not /auth/callback.
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
    redirectTo: `${appUrl}/auth/confirm`,
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

// Cancels a pending invite: removes the invitation row and the dangling Supabase auth user.
// We check our own users table (not Supabase's email_confirmed_at) to decide whether the
// auth account is safe to delete — a clicked-but-broken invite link can mark the email as
// confirmed in Supabase while leaving no users row in our DB.
export async function cancelInvite(formData: FormData) {
  const { orgId } = await getAdminContext()
  const supabaseAdmin = createAdminClient()
  const email = formData.get('email') as string

  // Verify the invite belongs to this org
  const invite = await db.query.invitations.findFirst({
    where: and(eq(invitations.email, email), eq(invitations.organizationId, orgId)),
  })
  if (!invite) return { error: 'Invite not found' }

  // Mark as cancelled (keep the row so the setup checklist stays satisfied)
  await db.update(invitations)
    .set({ usedAt: new Date() })
    .where(and(eq(invitations.email, email), eq(invitations.organizationId, orgId)))

  // Delete the Supabase auth user only if they have no users row in our DB.
  // A confirmed-but-broken invite leaves email_confirmed_at set but no users row.
  const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (!existingUser) {
    const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const authUser = authUsers.find(u => u.email === email)
    if (authUser) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id)
    }
  }

  revalidatePath('/admin/users')
  return { success: true }
}

export async function updateUserRole(formData: FormData) {
  const { orgId } = await getAdminContext()

  const userId = formData.get('userId') as string
  const role = formData.get('role') as string

  // Block switching a teacher/staff (who has employee records) to substitute —
  // doing so would orphan their absence history with no clean migration path.
  if (role === 'substitute') {
    const emp = await db.query.employees.findFirst({ where: eq(employees.userId, userId) })
    if (emp) {
      return { error: 'This user has teacher/staff records and cannot be switched to Substitute. Remove their absence history first, or contact support.' }
    }
  }

  // Block demoting the last admin/principal — org must always have at least one
  const target = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { role: true, organizationId: true } })
  if (target && (target.role === 'admin' || target.role === 'principal') && target.organizationId === orgId) {
    const newRoleIsAdmin = role === 'admin' || role === 'principal'
    if (!newRoleIsAdmin) {
      const adminCount = await db.query.users.findMany({
        where: and(eq(users.organizationId, orgId), or(eq(users.role, 'admin'), eq(users.role, 'principal'))),
        columns: { id: true },
      })
      if (adminCount.length <= 1) {
        return { error: 'Cannot demote the only administrator. Add another admin first.' }
      }
    }
  }

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
  // schoolIds is a JSON array of school UUIDs (multi-school support)
  const schoolIdsRaw = (formData.get('schoolIds') as string) || '[]'
  const schoolIds: string[] = JSON.parse(schoolIdsRaw)
  const primarySchoolId = schoolIds[0] ?? null

  const existing = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!existing || existing.organizationId !== orgId) return { error: 'User not found' }

  await db.update(users).set({ firstName, lastName, email, phone, schoolId: primarySchoolId }).where(eq(users.id, userId))

  // Keep Supabase auth email in sync if it changed
  if (email !== existing.email) {
    await supabaseAdmin.auth.admin.updateUserById(userId, { email })
  }

  // Sync employee school rows for teachers/staff (multi-school support)
  // We never delete a row that has teacher_time_off records pointing to it — that would
  // violate the FK. So: add new schools freely; only remove schools with no absence history.
  if (['teacher', 'staff'].includes(existing.role)) {
    const currentRows = await db
      .select({ id: employees.id, schoolId: employees.schoolId })
      .from(employees)
      .where(eq(employees.userId, userId))

    const currentSchoolIds = new Set(currentRows.map(r => r.schoolId))

    // Insert rows for newly added schools
    const toAdd = schoolIds.filter(sid => !currentSchoolIds.has(sid))
    if (toAdd.length > 0) {
      await db.insert(employees).values(toAdd.map(sid => ({ userId, schoolId: sid })))
    }

    // Remove rows for unchecked schools only if they have no absence history
    const toRemove = currentRows.filter(r => !schoolIds.includes(r.schoolId))
    for (const row of toRemove) {
      const hasAbsences = await db.query.teacherTimeOff.findFirst({
        where: eq(teacherTimeOff.employeeId, row.id),
      })
      if (!hasAbsences) {
        await db.delete(employees).where(eq(employees.id, row.id))
      }
    }
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

  // Block deletion of admin/principal — must demote to another role first
  if (existing.role === 'admin' || existing.role === 'principal') {
    return { error: 'Admins and principals cannot be deleted directly. Change their role to Staff or Teacher first.' }
  }

  // Safety net: ensure the org still has at least one admin/principal after deletion
  const adminUsers = await db.query.users.findMany({
    where: and(eq(users.organizationId, orgId), or(eq(users.role, 'admin'), eq(users.role, 'principal'))),
    columns: { id: true },
  })
  if (adminUsers.length === 0) {
    return { error: 'Cannot delete the only administrator. Add another admin first.' }
  }

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
    with: { campus: { columns: { id: true, address: true, city: true, state: true, zip: true, phone: true } } },
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
      county:       (formData.get('county') as string).trim() || null,
      phone:        (formData.get('phone') as string).trim() || null,
      website:      (formData.get('website') as string).trim() || null,
      dayStartTime:    (formData.get('dayStartTime') as string) || school.dayStartTime,
      dayEndTime:      (formData.get('dayEndTime') as string) || school.dayEndTime,
      timesConfigured: true, // admin has explicitly reviewed and saved the school
      updatedAt:       new Date(),
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

// ─── School directory search & claim ─────────────────────────────────────────

/**
 * Search the public school directory by name, city, or district.
 * Optionally filter by county. Returns up to 30 results.
 */
export async function searchDirectory(query: string, county?: string) {
  await getAdminContext()
  if (query.trim().length < 2) return []

  const nameCondition = or(
    ilike(schoolDirectory.schoolName, `%${query}%`),
    ilike(schoolDirectory.districtName, `%${query}%`),
    ilike(schoolDirectory.city, `%${query}%`),
  )

  const where = county
    ? and(nameCondition, eq(schoolDirectory.county, county))
    : nameCondition

  return db.query.schoolDirectory.findMany({
    where,
    with: { claimedByOrg: true },
    orderBy: (s, { asc }) => [asc(s.schoolName)],
    limit: 30,
  })
}

/**
 * Link an org's school record to a directory entry and copy the address/contact info.
 * Sets school_directory.claimed_by_org_id and updates the schools row.
 */
export async function claimDirectorySchool(schoolId: string, directoryEntryId: string) {
  const { orgId } = await getAdminContext()

  // Verify the school belongs to this org
  const school = await db.query.schools.findFirst({ where: eq(schools.id, schoolId) })
  if (!school || school.organizationId !== orgId) return { error: 'School not found' }

  const entry = await db.query.schoolDirectory.findFirst({
    where: eq(schoolDirectory.id, directoryEntryId),
  })
  if (!entry) return { error: 'Directory entry not found' }

  await Promise.all([
    // Copy info into the live school record
    db.update(schools)
      .set({
        address:  entry.address  ?? school.address,
        city:     entry.city     ?? school.city,
        state:    entry.state    ?? school.state,
        zip:      entry.zip      ?? school.zip,
        phone:    entry.phone    ?? school.phone,
        county:   entry.county,
      })
      .where(eq(schools.id, schoolId)),

    // Mark the directory entry as claimed by this org
    db.update(schoolDirectory)
      .set({ claimedByOrgId: orgId })
      .where(eq(schoolDirectory.id, directoryEntryId)),
  ])

  revalidatePath('/admin/schools')
  return { success: true, entry }
}

/**
 * Bulk-import users from a parsed CSV.
 *
 * sendInvites = true  → sends each person a Supabase invite email; users row created on first login
 * sendInvites = false → silently creates the auth account + users row immediately; admin tells
 *                       people to visit the app and use "Forgot Password" to set their password
 *
 * Phone is optional — stored if present, skipped if not.
 * Errors are collected per row rather than aborting the whole batch.
 */
export async function bulkInviteUsers(
  rows: Array<{ email: string; firstName: string; lastName: string; phone?: string; role: string; schoolId?: string }>,
  sendInvites: boolean
): Promise<{ sent: number; errors: string[] }> {
  const { orgId, adminUserId } = await getAdminContext()
  const supabaseAdmin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

  let sent = 0
  const errors: string[] = []

  for (const row of rows) {
    const role     = row.role
    const schoolId = row.schoolId ?? null
    try {
      if (sendInvites) {
        // ── Invite path: Supabase sends email; users row created on first login ──
        const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(row.email, {
          redirectTo: `${appUrl}/auth/confirm`,
          data: { firstName: row.firstName, lastName: row.lastName, role, orgId, schoolId, phone: row.phone ?? null },
        })
        if (error) { errors.push(`${row.email}: ${error.message}`); continue }

        await db.insert(invitations).values({
          organizationId: orgId,
          schoolId,
          email: row.email,
          role: role as 'admin' | 'principal' | 'staff' | 'teacher' | 'substitute',
          invitedBy: adminUserId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
      } else {
        // ── Silent path: create account + users row now; person uses Forgot Password ──
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: row.email,
          email_confirm: true,
          user_metadata: { firstName: row.firstName, lastName: row.lastName },
        })
        if (error || !data.user) { errors.push(`${row.email}: ${error?.message ?? 'Unknown error'}`); continue }

        const newId = data.user.id
        await db.insert(users).values({
          id: newId,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          phone: row.phone ?? null,
          role: role as 'admin' | 'principal' | 'staff' | 'teacher' | 'substitute',
          organizationId: orgId,
          schoolId,
        })

        if (role === 'teacher' && schoolId) {
          await db.insert(employees).values({ userId: newId, schoolId })
        } else if (role === 'substitute') {
          const [sub] = await db.insert(substitutes).values({ userId: newId }).returning()
          if (schoolId && sub) {
            await db.insert(subSchoolAssignments).values({
              substituteId: sub.id,
              schoolId,
              organizationId: orgId,
              status: 'active',
            })
          }
        }
      }

      sent++
    } catch (err) {
      errors.push(`${row.email}: ${String(err)}`)
    }
  }

  revalidatePath('/admin/users')
  return { sent, errors }
}

export async function saveUserAvatar(userId: string, url: string) {
  const { orgId } = await getAdminContext()
  const target = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!target || target.organizationId !== orgId) throw new Error('User not found')
  await db.update(users).set({ avatarUrl: url }).where(eq(users.id, userId))
  revalidatePath('/admin/users')
}
