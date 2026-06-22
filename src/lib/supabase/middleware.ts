/**
 * Supabase Auth middleware for Next.js.
 * 
 * This middleware runs on EVERY request before it reaches your page.
 * Its job: refresh the user's auth token so they stay logged in.
 * 
 * Without this middleware, auth sessions would expire and users would 
 * get randomly logged out. The middleware catches requests before they 
 * hit your pages, checks if the session needs refreshing, and updates cookies.
 * 
 * This is the official Supabase SSR pattern for Next.js App Router.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — this is the important part
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect routes that require authentication
  // If user is not logged in and trying to access /dashboard or /absences etc,
  // redirect them to the login page
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/api/twilio/') &&
    !request.nextUrl.pathname.startsWith('/api/cron/') &&
    !request.nextUrl.pathname.startsWith('/api/dispatcher') &&
    !request.nextUrl.pathname.startsWith('/api/blast/') &&
    !request.nextUrl.pathname.startsWith('/sub/jobs/') &&
    request.nextUrl.pathname !== '/'
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // If user IS logged in and visits the login/signup page, send to role portal
  if (user && request.nextUrl.pathname.startsWith('/auth') &&
      !request.nextUrl.pathname.startsWith('/auth/callback') &&
      !request.nextUrl.pathname.startsWith('/auth/portal') &&
      !request.nextUrl.pathname.startsWith('/auth/confirm') &&
      !request.nextUrl.pathname.startsWith('/auth/signout')) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/portal';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}