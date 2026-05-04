/**
 * Dashboard/app layout — wraps all authenticated pages with the sidebar.
 * 
 * This layout provides:
 * - Left sidebar (navigation)
 * - Main content area (where page content renders)
 * - Top bar (with school/org info)
 * 
 * Pages inside this layout are automatically protected by the middleware
 * (users must be logged in to see them).
 */

import { createClient } from '@/lib/supabase/server';
import { AppSidebar } from '@/components/app-sidebar';
import { redirect } from 'next/navigation';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Double-check auth — middleware should have already redirected,
  // but this is a safety check
  if (!user) {
    redirect('/auth/login');
  }

  // Get user's profile for the top bar
  // schools is a foreign key join — Supabase returns it as an array
  const { data: profile } = await supabase
    .from('users')
    .select('first_name, last_name, school_id, schools(name)')
    .eq('id', user.id)
    .single();

  // Extract school name from Supabase foreign key join result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schoolName = Array.isArray(profile?.schools)
    ? profile.schools[0]?.name
    : (profile?.schools as unknown as { name: string } | null)?.name;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
          <div className="flex items-center gap-4">
            {schoolName && (
              <span className="text-sm text-gray-500">{schoolName}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Notifications placeholder */}
            <div className="text-sm text-gray-500">
              {profile?.first_name || user?.email}
            </div>
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              {profile?.first_name?.[0]}{profile?.last_name?.[0] || user?.email?.[0]?.toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}