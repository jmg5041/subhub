/**
 * Manage Users page — Admin only.
 *
 * Lets admin invite new teachers, staff, and substitutes via email.
 * Shows all users in the org with their role and invite status.
 * Admin can change roles, deactivate users, and resend invites.
 */

import { getOrgUsers } from '../actions'
import ManageUsersClient from './ManageUsersClient'
import { db } from '@/db'
import { users } from '@/db/schema'
import { createClient } from '@/lib/supabase/server'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'

export default async function ManageUsersPage() {
  // Double-check: only admin/principal can access this page
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile || (!['admin', 'principal'].includes(profile.role) && !profile.isPlatformAdmin)) {
    redirect('/dashboard')
  }

  const { users: orgUsers, invites, schools } = await getOrgUsers()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8 text-gray-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Users</h1>
          <p className="text-gray-500">Invite and manage teachers, staff, and substitutes.</p>
        </div>
      </div>

      <ManageUsersClient users={orgUsers} invites={invites} schools={schools} />
    </div>
  )
}
