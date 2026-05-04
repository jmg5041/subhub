/**
 * Next.js middleware — runs on every request before pages load.
 * 
 * This file uses Supabase's auth middleware to keep sessions alive
 * and redirect unauthenticated users to the login page.
 * 
 * See src/lib/supabase/middleware.ts for the actual session logic.
 */

import { updateSession } from '@/lib/supabase/middleware';
import { type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// Only run middleware on these paths (skip static assets, API health checks, etc.)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};