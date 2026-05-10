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
import { AppShell } from '@/components/app-shell';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { subSchoolAssignments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

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
    .select('first_name, last_name, role, school_id, avatar_url, schools(name)')
    .eq('id', user.id)
    .single();

  // Extract school name from Supabase foreign key join result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schoolName = Array.isArray(profile?.schools)
    ? profile.schools[0]?.name
    : (profile?.schools as unknown as { name: string } | null)?.name;

  // Pending sub join requests — only fetch for admin/principal roles
  let pendingSubCount = 0
  if (profile?.role && ['admin', 'principal', 'staff'].includes(profile.role)) {
    const { data: orgData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
    if (orgData?.organization_id) {
      const rows = await db
        .select({ id: subSchoolAssignments.id })
        .from(subSchoolAssignments)
        .where(and(eq(subSchoolAssignments.organizationId, orgData.organization_id), eq(subSchoolAssignments.status, 'pending')))
      pendingSubCount = rows.length
    }
  }

  return (
    <AppShell
      schoolName={schoolName ?? null}
      firstName={profile?.first_name ?? null}
      lastName={profile?.last_name ?? null}
      email={user?.email ?? null}
      role={profile?.role ?? null}
      avatarUrl={profile?.avatar_url ?? null}
      pendingSubCount={pendingSubCount}
    >
      {children}
    </AppShell>
  );
}