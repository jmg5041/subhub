import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, organizations, schools, platformSettings } from '@/db/schema'
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

  const [org, existingSchools, settings] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(organizations.id, profile.organizationId) }),
    db.query.schools.findMany({ where: eq(schools.organizationId, profile.organizationId) }),
    db.query.platformSettings.findFirst(),
  ])

  if (org?.onboardingCompletedAt) redirect('/dashboard')

  const params = await searchParams
  const billingAlreadySetUp = !!org?.stripeCustomerId || org?.paymentMethod === 'check'
  const returningFromStripe = params.billing === 'done'
  const pricePerSeatCents = settings?.pricePerSeatCents ?? 800

  // Resume at the right step
  const startStep =
    returningFromStripe || (existingSchools.length > 0 && billingAlreadySetUp) ? 4
    : existingSchools.length > 0 ? 3
    : 1

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-gray-900">Set up your school</h1>
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
          }}
          orgId={profile.organizationId}
          initialSchools={existingSchools.map((s) => ({
            id:           s.id,
            name:         s.name,
            city:         s.city,
            county:       s.county,
            dayStartTime: s.dayStartTime,
            dayEndTime:   s.dayEndTime,
          }))}
          startStep={startStep}
          billingAlreadySetUp={billingAlreadySetUp}
          pricePerSeatCents={pricePerSeatCents}
          initialSeatCount={org?.seatCount ?? null}
        />
      </div>
    </div>
  )
}
