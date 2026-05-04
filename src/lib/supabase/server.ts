/**
 * Supabase client for server-side usage (Server Components, Route Handlers, Server Actions).
 * 
 * This creates a Supabase client with the user's auth cookies attached.
 * It's used in Next.js Server Components and server-side logic.
 * 
 * Key difference from the browser client:
 * - This one reads cookies from the incoming request
 * - After auth operations, it sets cookies on the outgoing response
 * - This allows server-side auth state to persist properly
 * 
 * Usage: import { createClient } from '@/lib/supabase/server'
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The setAll method is called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}