/**
 * Portal redirect — reads the current session and sends the user to the right portal.
 * Also handles first-time invited users: creates their users row from user_metadata
 * and marks the invitation as used. This covers both PKCE (from /auth/callback) and
 * implicit flow (from /auth/confirm) entry points.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, invitations, employees, substitutes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { provisionSelfSignupOrg } from '@/lib/self-signup'

function roleToPortal(role: string | null | undefined): string {
  switch (role) {
    case 'teacher':   return '/teacher'
    case 'substitute': return '/sub/dashboard'
    case 'district':  return '/district'
    default:          return '/dashboard'
  }
}

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/login`)
  }

  // Look up profile by Supabase auth ID
  let profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  })

  // Seeded user with placeholder ID — link them
  if (!profile && user.email) {
    const byEmail = await db.query.users.findFirst({
      where: eq(users.email, user.email),
    })
    if (byEmail) {
      await db.update(users).set({ id: user.id }).where(eq(users.email, user.email))
      profile = { ...byEmail, id: user.id }
    }
  }

  // Brand-new invited user — create their users row from invite metadata
  if (!profile && user.email && user.user_metadata?.orgId) {
    const meta = user.user_metadata
    const role = (meta.role as string) || 'teacher'
    const schoolId = (meta.schoolId as string) || null
    await db.insert(users).values({
      id: user.id,
      email: user.email,
      firstName: (meta.firstName as string) || user.email.split('@')[0],
      lastName: (meta.lastName as string) || '',
      phone: (meta.phone as string) || null,
      role: role as 'admin' | 'principal' | 'staff' | 'teacher' | 'substitute' | 'district',
      organizationId: meta.orgId as string,
      schoolId,
      isPlatformAdmin: meta.isPlatformAdmin === true,
    })

    // Create the role-specific profile row so the portal works immediately
    if (role === 'teacher' && schoolId) {
      await db.insert(employees).values({ userId: user.id, schoolId })
    } else if (role === 'substitute') {
      await db.insert(substitutes).values({ userId: user.id })
    }

    await db.update(invitations)
      .set({ usedAt: new Date() })
      .where(eq(invitations.email, user.email))
    return NextResponse.redirect(`${origin}${roleToPortal(role)}`)
  }

  // Self-signup landing via implicit flow (e.g. Google OAuth or re-visit after confirm)
  if (!profile && user.email && user.user_metadata?.selfSignup) {
    await provisionSelfSignupOrg(user)
    return NextResponse.redirect(`${origin}/onboarding`)
  }

  // No profile and no matching condition — this person has no account on SubHub.
  // Sign them out so the session doesn't linger, then show the no-account page.
  if (!profile) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/auth/no-account`)
  }

  // If an existing user's role was changed to substitute but the substitutes row
  // was never created (e.g. role changed via admin UI, not via invite flow), create it now.
  if (profile.role === 'substitute') {
    const existing = await db.query.substitutes.findFirst({ where: eq(substitutes.userId, user.id) })
    if (!existing) {
      await db.insert(substitutes).values({ userId: user.id })
    }
  }

  // Platform admins always land on /platform, not a school portal
  if (profile.isPlatformAdmin) {
    return NextResponse.redirect(`${origin}/platform`)
  }

  return NextResponse.redirect(`${origin}${roleToPortal(profile.role)}`)
}
