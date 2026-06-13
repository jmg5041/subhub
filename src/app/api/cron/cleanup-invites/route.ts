/**
 * Cron: cleanup-invites
 * Runs nightly. Deletes expired invitations and their unconfirmed Supabase auth users.
 * Prevents limbo accounts from accumulating when invites are ignored.
 */

import { NextResponse } from 'next/server'
import { db } from '@/db'
import { invitations } from '@/db/schema'
import { createAdminClient } from '@/lib/supabase/admin'
import { lt, eq } from 'drizzle-orm'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createAdminClient()
  const now = new Date()

  // Find all expired, unused invitations
  const expired = await db.query.invitations.findMany({
    where: lt(invitations.expiresAt, now),
    columns: { id: true, email: true, usedAt: true },
  })

  // Only clean up invites that were never used
  const toClean = expired.filter(i => !i.usedAt)

  if (toClean.length === 0) {
    return NextResponse.json({ cleaned: 0 })
  }

  // Fetch all Supabase auth users once (cheaper than one call per invite)
  const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authByEmail = new Map(authUsers.map(u => [u.email, u]))

  let cleaned = 0
  for (const invite of toClean) {
    // Delete unconfirmed Supabase auth user if one exists
    const authUser = authByEmail.get(invite.email)
    if (authUser && !authUser.email_confirmed_at) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id)
    }

    // Delete this invitation row
    await db.delete(invitations).where(eq(invitations.id, invite.id))
    cleaned++
  }

  return NextResponse.json({ cleaned })
}
