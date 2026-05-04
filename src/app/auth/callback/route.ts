/**
 * Auth callback handler — processes OAuth redirects (like Google Sign-in).
 * 
 * When a user clicks "Sign in with Google", Google authenticates them
 * and redirects back here with an auth code. This page exchanges that code
 * for a session cookie, then sends the user to the dashboard.
 * 
 * This is a required part of the Supabase Auth flow for OAuth providers.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // If user was redirected from a specific page, send them back there
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If no code or error, redirect to login with error
  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}