/**
 * Supabase client for browser-side usage.
 * 
 * This file creates a Supabase client that runs in the browser.
 * It uses the ANON key (safe to expose) and respects Row-Level Security (RLS).
 * 
 * Every request from this client is subject to RLS policies — 
 * users can only see data from their own organization/school.
 * 
 * Usage: import { createClient } from '@/lib/supabase/client'
 */

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}