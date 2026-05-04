/**
 * Auth callback handler — processes OAuth redirects (Google Sign-in) and invite links.
 *
 * After session exchange, looks up the user's role and redirects them to
 * the correct portal. Also handles ID linkage: seeded users in the `users`
 * table have placeholder UUIDs — when they first sign in via invite or OAuth,
 * we update their row to use the real Supabase auth user ID.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

function roleToPortal(role: string | null | undefined): string {
  switch (role) {
    case 'teacher': return '/teacher'
    case 'substitute': return '/sub/dashboard'
    default: return '/dashboard'  // admin, principal, staff
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`)
  }

  const authUser = data.session.user

  // Look up the user's profile by their Supabase auth ID first
  let profile = await db.query.users.findFirst({
    where: eq(users.id, authUser.id),
  })

  // If not found by ID, check by email (seeded users have placeholder IDs)
  if (!profile && authUser.email) {
    const byEmail = await db.query.users.findFirst({
      where: eq(users.email, authUser.email),
    })

    if (byEmail) {
      // Link: update the placeholder UUID to the real Supabase auth user ID
      await db
        .update(users)
        .set({ id: authUser.id })
        .where(eq(users.email, authUser.email))
      profile = { ...byEmail, id: authUser.id }
    }
  }

  // If still no profile (brand new user not seeded), create a minimal one
  // They'll get assigned an org/role through the admin invite flow
  if (!profile) {
    const portal = roleToPortal(null)
    return NextResponse.redirect(`${origin}${portal}`)
  }

  return NextResponse.redirect(`${origin}${roleToPortal(profile.role)}`)
}
