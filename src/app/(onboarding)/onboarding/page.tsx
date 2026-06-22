import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, organizations, campuses, platformSettings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import OnboardingWizard from './OnboardingWizard'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile) redirect('/auth/login')

  const [org, existingCampuses, settings] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(organizations.id, profile.organizationId) }),
    db.query.campuses.findMany({
      where: eq(campuses.organizationId, profile.organizationId),
      with: { schools: { columns: { id: true, name: true } } },
      orderBy: (c, { asc }) => [asc(c.createdAt)],
    }),
    db.query.platformSettings.findFirst(),
  ])

  if (org?.onboardingCompletedAt) redirect('/dashboard')

  const params = await searchParams
  const billingAlreadySetUp = !!org?.stripeCustomerId || org?.paymentMethod === 'check'
  const returningFromStripe = params.billing === 'done'
  const promoCode = params.billing === 'promo'
    ? ((params as Record<string, string>).code ?? org?.planNotes?.replace('PROMO:', '') ?? null)
    : (org?.planNotes?.startsWith('PROMO:') ? org.planNotes.replace('PROMO:', '') : null)
  const pricePerSeatCents = settings?.pricePerSeatCents ?? 800

  const startStep =
    returningFromStripe ? 4
    : existingCampuses.length > 0 ? 3
    : 1

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-gray-900">Welcome to onboarding!</h1>
      <p className="text-sm text-gray-500">
        Complete these steps to start managing substitutes. You can always change these settings later.
      </p>
      <div className="pt-4">
        <OnboardingWizard
          org={{
            timezone:       org?.timezone       ?? null,
            subPayModel:    org?.subPayModel     ?? null,
            halfDayHours:   org?.halfDayHours    ?? null,
            fullDayHours:   org?.fullDayHours    ?? null,
            autoNotifySubs: org?.autoNotifySubs  ?? null,
            notifyByEmail:  org?.notifyByEmail   ?? null,
            notifyBySms:    org?.notifyBySms     ?? null,
            notifyByPhone:  org?.notifyByPhone   ?? null,
            districtName:   org?.districtName    ?? null,
          }}
          orgId={profile.organizationId}
          initialCampuses={existingCampuses.map(c => ({
            id:      c.id,
            address: c.address,
            city:    c.city,
            state:   c.state,
            zip:     c.zip,
            phone:   c.phone,
            schools: c.schools,
          }))}
          startStep={startStep}
          billingAlreadySetUp={billingAlreadySetUp}
          promoCode={promoCode}
          pricePerSeatCents={pricePerSeatCents}
          initialSeatCount={org?.seatCount ?? null}
        />
      </div>
    </div>
  )
}
