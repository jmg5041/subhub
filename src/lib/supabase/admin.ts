/**
 * Supabase client with SERVICE ROLE — bypasses all Row-Level Security.
 * 
 * ⚠️ ONLY use this in server-side code that needs admin access (migrations, seeding, batch ops).
 * ⚠️ NEVER import this in a client component or expose the key to the browser.
 * 
 * This client can read/write ANY data in ANY organization. 
 * Use it for: database migrations, seed scripts, admin batch operations.
 * 
 * Usage: import { createAdminClient } from '@/lib/supabase/admin'
 */

import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}