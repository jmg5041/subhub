import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organizations, subSchoolAssignments, users, substitutes } from '@/db/schema';
import { eq, and, count, notExists } from 'drizzle-orm';
import { getBillingState } from '@/lib/billing';
import { BillingBanner } from '@/components/BillingBanner';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { getImpersonatedOrg } from '@/lib/impersonation';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: {
      firstName: true, lastName: true, role: true,
      schoolId: true, avatarUrl: true, organizationId: true, isPlatformAdmin: true,
    },
    with: { school: { columns: { name: true } } },
  });

  if (!profile) {
    await supabase.auth.signOut()
    redirect('/auth/login')
  }

  const schoolName = profile?.school?.name ?? null;
  const isPlatformAdmin = profile?.isPlatformAdmin ?? false

  // Check if platform admin is currently impersonating a school org
  const impersonatedOrg = await getImpersonatedOrg(isPlatformAdmin)

  // Platform admins with no active impersonation have no school context — send to platform
  if (isPlatformAdmin && !impersonatedOrg) {
    redirect('/platform')
  }

  // District users have their own portal
  if (profile?.role === 'district' && !isPlatformAdmin) {
    redirect('/district')
  }

  const orgId = impersonatedOrg?.id ?? profile?.organizationId

  // Billing + onboarding gates — skipped for platform admins (they're never blocked)
  let pendingSubCount = 0
  let billingState = null

  if (!isPlatformAdmin && profile?.role && ['admin', 'principal', 'staff'].includes(profile.role) && orgId) {
    const [org, pendingRows] = await Promise.all([
      db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
        columns: { onboardingCompletedAt: true, subscriptionStatus: true, paidThrough: true },
      }),
      db.select({ id: subSchoolAssignments.id })
        .from(subSchoolAssignments)
        .where(and(eq(subSchoolAssignments.organizationId, orgId), eq(subSchoolAssignments.status, 'pending'))),
    ])

    if (!org?.onboardingCompletedAt) redirect('/onboarding')

    billingState = getBillingState({ subscriptionStatus: org.subscriptionStatus, paidThrough: org.paidThrough })
    if (billingState.status === 'expired') redirect('/billing')

    pendingSubCount = pendingRows.length
  }

  // Notices count (bounced emails + subs with no school assignment)
  let noticesCount = 0
  const effectiveOrgForNotices = orgId
  if (effectiveOrgForNotices) {
    const [orgForNotices, bounced, unassigned] = await Promise.all([
      db.query.organizations.findFirst({ where: eq(organizations.id, effectiveOrgForNotices), columns: { cronEnabled: true } }),
      db.select({ c: count() }).from(users)
        .where(and(eq(users.organizationId, effectiveOrgForNotices), eq(users.emailBounced, true))),
      db.select({ c: count() }).from(substitutes)
        .innerJoin(users, eq(substitutes.userId, users.id))
        .where(and(
          eq(users.organizationId, effectiveOrgForNotices),
          notExists(
            db.select({ id: subSchoolAssignments.id }).from(subSchoolAssignments)
              .where(eq(subSchoolAssignments.substituteId, substitutes.id))
          )
        )),
    ])
    const pausedCount = orgForNotices?.cronEnabled === false ? 1 : 0
    noticesCount = pausedCount + Number(bounced[0]?.c ?? 0) + Number(unassigned[0]?.c ?? 0)
  }

  // When impersonating, still show the pending sub badge for the impersonated org
  if (isPlatformAdmin && impersonatedOrg) {
    const pendingRows = await db.select({ id: subSchoolAssignments.id })
      .from(subSchoolAssignments)
      .where(and(eq(subSchoolAssignments.organizationId, impersonatedOrg.id), eq(subSchoolAssignments.status, 'pending')))
    pendingSubCount = pendingRows.length
  }

  return (
    <AppShell
      schoolName={impersonatedOrg?.name ?? schoolName ?? null}
      firstName={profile?.firstName ?? null}
      lastName={profile?.lastName ?? null}
      email={user?.email ?? null}
      role={profile?.role ?? null}
      avatarUrl={profile?.avatarUrl ?? null}
      pendingSubCount={pendingSubCount}
      noticesCount={noticesCount}
      isPlatformAdmin={isPlatformAdmin}
    >
      {impersonatedOrg && <ImpersonationBanner orgName={impersonatedOrg.name} />}
      {billingState && <BillingBanner state={billingState} />}
      {children}
    </AppShell>
  );
}
