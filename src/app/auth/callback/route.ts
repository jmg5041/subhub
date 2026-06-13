/**
 * Auth callback — handles OAuth redirects, invite link acceptance, and magic links.
 *
 * After session exchange:
 * 1. Look up the user's profile by Supabase auth ID.
 * 2. If not found by ID, check by email (seeded users have placeholder IDs → update them).
 * 3. If still not found (brand-new invited user), create the users row from invite metadata
 *    stored in user_metadata by inviteUserByEmail/generateLink, then mark the invitation used.
 * 4. Redirect to the correct portal by role.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, invitations, employees, substitutes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { provisionSelfSignupOrg } from '@/lib/self-signup'

function roleToPortal(role: string | null | undefined): string {
  switch (role) {
    case 'teacher': return '/teacher'
    case 'substitute': return '/sub/dashboard'
    default: return '/dashboard'
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

  // 1. Look up by Supabase auth ID
  let profile = await db.query.users.findFirst({
    where: eq(users.id, authUser.id),
  })

  // 2. Look up by email (seeded users have placeholder IDs)
  if (!profile && authUser.email) {
    const byEmail = await db.query.users.findFirst({
      where: eq(users.email, authUser.email),
    })
    if (byEmail) {
      await db
        .update(users)
        .set({ id: authUser.id })
        .where(eq(users.email, authUser.email))
      profile = { ...byEmail, id: authUser.id }
    }
  }

  // 3. Brand-new invited user — create their users row from invite metadata
  if (!profile && authUser.email) {
    const meta = authUser.user_metadata ?? {}
    const firstName = (meta.firstName as string) || authUser.email.split('@')[0]
    const lastName = (meta.lastName as string) || ''
    const role = (meta.role as string) || 'teacher'
    const orgId = meta.orgId as string | undefined
    const schoolId = (meta.schoolId as string) || null

    if (orgId) {
      await db.insert(users).values({
        id: authUser.id,
        email: authUser.email,
        firstName,
        lastName,
        phone: (meta.phone as string) || null,
        role: role as 'admin' | 'principal' | 'staff' | 'teacher' | 'substitute',
        organizationId: orgId,
        schoolId,
      })

      // Create the role-specific profile row so the portal works immediately
      if (role === 'teacher' && schoolId) {
        await db.insert(employees).values({ userId: authUser.id, schoolId })
      } else if (role === 'substitute') {
        await db.insert(substitutes).values({ userId: authUser.id })
      }

      // Mark invitation as used
      await db
        .update(invitations)
        .set({ usedAt: new Date() })
        .where(eq(invitations.email, authUser.email))

      return NextResponse.redirect(`${origin}${roleToPortal(role)}`)
    }

    // Self-signup: no invite orgId, but selfSignup flag set — provision the org now
    if (meta.selfSignup) {
      await provisionSelfSignupOrg(authUser)
      return NextResponse.redirect(`${origin}/onboarding`)
    }
  }

  if (!profile) {
    return NextResponse.redirect(`${origin}/auth/login?error=no_profile`)
  }

  return NextResponse.redirect(`${origin}${roleToPortal(profile.role)}`)
}
