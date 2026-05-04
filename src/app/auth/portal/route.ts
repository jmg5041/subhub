/**
 * Portal redirect — called after email/password login to send users to the right portal.
 * Reads the current session, looks up the user's role, and redirects accordingly.
 *
 *   admin / principal / staff → /dashboard
 *   teacher                   → /teacher
 *   substitute                → /sub/dashboard
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
    default: return '/dashboard'
  }
}

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/login`)
  }

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  })

  return NextResponse.redirect(`${origin}${roleToPortal(profile?.role)}`)
}
