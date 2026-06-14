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
import { organizations, subSchoolAssignments, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getBillingState } from '@/lib/billing';
import { BillingBanner } from '@/components/BillingBanner';

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
    .select('first_name, last_name, role, school_id, avatar_url, organization_id, schools(name)')
    .eq('id', user.id)
    .single();

  // If profile is missing the user row was deleted — sign out and clear the cached session
  if (!profile) {
    await supabase.auth.signOut()
    redirect('/auth/login')
  }

  // Extract school name from Supabase foreign key join result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schoolName = Array.isArray(profile?.schools)
    ? profile.schools[0]?.name
    : (profile?.schools as unknown as { name: string } | null)?.name;

  // Admin/principal/staff: onboarding gate + billing gate + pending sub count
  let pendingSubCount = 0
  let billingState = null
  let isPlatformAdmin = false
  const orgId = (profile as unknown as { organization_id?: string })?.organization_id

  if (profile?.role && ['admin', 'principal', 'staff'].includes(profile.role) && orgId) {
    const [org, pendingRows, userRow] = await Promise.all([
      db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
        columns: { onboardingCompletedAt: true, subscriptionStatus: true, paidThrough: true },
      }),
      db.select({ id: subSchoolAssignments.id })
        .from(subSchoolAssignments)
        .where(and(eq(subSchoolAssignments.organizationId, orgId), eq(subSchoolAssignments.status, 'pending'))),
      db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: { isPlatformAdmin: true },
      }),
    ])

    if (!org?.onboardingCompletedAt) redirect('/onboarding')

    billingState = getBillingState({ subscriptionStatus: org.subscriptionStatus, paidThrough: org.paidThrough })
    if (billingState.status === 'expired') redirect('/billing')

    pendingSubCount = pendingRows.length
    isPlatformAdmin = userRow?.isPlatformAdmin ?? false
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
      isPlatformAdmin={isPlatformAdmin}
    >
      {billingState && <BillingBanner state={billingState} />}
      {children}
    </AppShell>
  );
}