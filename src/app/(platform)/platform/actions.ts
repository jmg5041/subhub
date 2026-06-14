'use server'

import { db } from '@/db'
import {
  users, organizations, billingEvents, invitations, platformSettings,
  schools, employees, substitutes, absenceReasons, teacherTimeOff,
  subAssignments, assignmentTimeOff, subNotificationTokens, subPriorityOrders,
  subSchoolAssignments, subUnavailability, attachments, schoolDirectory,
} from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect, notFound } from 'next/navigation'

export async function getPlatformContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { id: true, isPlatformAdmin: true },
  })
  if (!profile?.isPlatformAdmin) throw new Error('Not authorized')

  return { adminUserId: profile.id }
}

export async function recordCheckPayment(formData: FormData) {
  const { adminUserId } = await getPlatformContext()

  const orgId       = formData.get('orgId') as string
  const amountStr   = formData.get('amount') as string
  const paidThrough = formData.get('paidThrough') as string
  const note        = (formData.get('note') as string) || null

  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
  if (!org) notFound()

  const amountCents = amountStr ? Math.round(parseFloat(amountStr) * 100) : null

  await Promise.all([
    db.update(organizations)
      .set({
        subscriptionStatus: 'active',
        paymentMethod: 'check',
        paidThrough,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId)),

    db.insert(billingEvents).values({
      organizationId: orgId,
      type: 'check_payment',
      amountCents,
      note,
      createdBy: adminUserId,
    }),
  ])

  revalidatePath(`/platform/${orgId}`)
  revalidatePath('/platform')
  redirect(`/platform/${orgId}`)
}

// Reset password for any user in any org
export async function platformResetPassword(formData: FormData): Promise<{ error: string } | { success: true }> {
  await getPlatformContext()
  const supabaseAdmin = createAdminClient()

  const userId   = formData.get('userId') as string
  const password = formData.get('password') as string

  if (!password || password.length < 8) return { error: 'Password must be at least 8 characters' }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
  if (error) return { error: error.message }

  return { success: true }
}

// Delete a dangling Supabase auth account that has no users row (stuck invite)
export async function platformClearStuckAuth(formData: FormData): Promise<{ error: string } | { success: true }> {
  await getPlatformContext()
  const supabaseAdmin = createAdminClient()

  const email = formData.get('email') as string

  // Safety: only clear if there's no users row
  const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existingUser) return { error: 'This email has an active account — use Reset Password instead' }

  const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authUser = authUsers.find(u => u.email === email)
  if (!authUser) return { error: 'No auth account found for this email' }

  await supabaseAdmin.auth.admin.deleteUser(authUser.id)

  // Also clear any invitation rows so the email can be re-invited cleanly
  await db.delete(invitations).where(eq(invitations.email, email))

  return { success: true }
}

export async function saveStaffAlertEmail(formData: FormData) {
  await getPlatformContext()
  const email = (formData.get('staffAlertEmail') as string).trim()

  await db.insert(platformSettings)
    .values({ id: 1, staffAlertEmail: email })
    .onConflictDoUpdate({ target: platformSettings.id, set: { staffAlertEmail: email, updatedAt: new Date() } })

  revalidatePath('/platform')
  redirect('/platform')
}

export async function setCronEnabled(formData: FormData) {
  await getPlatformContext()

  const orgId  = formData.get('orgId') as string
  const enable = formData.get('enable') === 'true'

  await db.update(organizations)
    .set({ cronEnabled: enable, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))

  revalidatePath(`/platform/${orgId}`)
  redirect(`/platform/${orgId}`)
}

export async function deleteOrganization(formData: FormData) {
  await getPlatformContext()
  const supabaseAdmin = createAdminClient()

  const orgId       = formData.get('orgId') as string
  const confirmName = (formData.get('confirmName') as string).trim()

  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
  if (!org) notFound()
  if (confirmName !== org.name) redirect(`/platform/${orgId}?deleteError=name_mismatch`)

  // ── Step 1: Collect IDs needed for child-table deletes ─────────────────────
  const orgUsers = await db.select({ id: users.id }).from(users).where(eq(users.organizationId, orgId))
  const orgUserIds = orgUsers.map(u => u.id)

  const orgSubs = orgUserIds.length > 0
    ? await db.select({ id: substitutes.id }).from(substitutes).where(inArray(substitutes.userId, orgUserIds))
    : []
  const orgSubIds = orgSubs.map(s => s.id)

  const orgTimeOff = await db.select({ id: teacherTimeOff.id }).from(teacherTimeOff).where(eq(teacherTimeOff.organizationId, orgId))
  const orgTimeOffIds = orgTimeOff.map(t => t.id)

  const orgAssignments = await db.select({ id: subAssignments.id }).from(subAssignments).where(eq(subAssignments.organizationId, orgId))
  const orgAssignmentIds = orgAssignments.map(a => a.id)

  // ── Step 2: Delete child records (deepest dependencies first) ──────────────
  if (orgSubIds.length > 0 || orgTimeOffIds.length > 0) {
    const tokenFilter = []
    if (orgSubIds.length > 0) tokenFilter.push(inArray(subNotificationTokens.substituteId, orgSubIds))
    if (orgTimeOffIds.length > 0) tokenFilter.push(inArray(subNotificationTokens.teacherTimeOffId, orgTimeOffIds))
    for (const f of tokenFilter) await db.delete(subNotificationTokens).where(f)
  }

  if (orgAssignmentIds.length > 0)
    await db.delete(assignmentTimeOff).where(inArray(assignmentTimeOff.assignmentId, orgAssignmentIds))

  await db.delete(attachments).where(eq(attachments.organizationId, orgId))
  await db.delete(subAssignments).where(eq(subAssignments.organizationId, orgId))
  await db.delete(teacherTimeOff).where(eq(teacherTimeOff.organizationId, orgId))
  if (orgUserIds.length > 0)
    await db.delete(employees).where(inArray(employees.userId, orgUserIds))
  await db.delete(subPriorityOrders).where(eq(subPriorityOrders.organizationId, orgId))
  await db.delete(subSchoolAssignments).where(eq(subSchoolAssignments.organizationId, orgId))

  if (orgSubIds.length > 0) {
    await db.delete(subUnavailability).where(inArray(subUnavailability.substituteId, orgSubIds))
    await db.delete(substitutes).where(inArray(substitutes.userId, orgUserIds))
  }

  await db.delete(invitations).where(eq(invitations.organizationId, orgId))
  await db.delete(billingEvents).where(eq(billingEvents.organizationId, orgId))
  await db.delete(absenceReasons).where(eq(absenceReasons.organizationId, orgId))

  // Release any school directory claims
  await db.update(schoolDirectory)
    .set({ claimedByOrgId: null })
    .where(eq(schoolDirectory.claimedByOrgId, orgId))

  await db.delete(schools).where(eq(schools.organizationId, orgId))

  // ── Step 3: Delete Supabase auth accounts then user rows ───────────────────
  for (const u of orgUsers) {
    try { await supabaseAdmin.auth.admin.deleteUser(u.id) } catch { /* not found = fine */ }
  }
  if (orgUserIds.length > 0)
    await db.delete(users).where(inArray(users.id, orgUserIds))

  // ── Step 4: Delete the org itself ──────────────────────────────────────────
  await db.delete(organizations).where(eq(organizations.id, orgId))

  redirect('/platform')
}

export async function addBillingNote(formData: FormData) {
  const { adminUserId } = await getPlatformContext()

  const orgId = formData.get('orgId') as string
  const note  = formData.get('note') as string

  await db.insert(billingEvents).values({
    organizationId: orgId,
    type: 'note',
    note,
    createdBy: adminUserId,
  })

  revalidatePath(`/platform/${orgId}`)
  redirect(`/platform/${orgId}`)
}
