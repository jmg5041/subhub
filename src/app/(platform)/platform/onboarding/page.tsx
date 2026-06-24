import { getPlatformContext } from '../actions'
import Link from 'next/link'

export default async function OnboardingGuidePage() {
  await getPlatformContext()

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link href="/platform" className="text-gray-500 hover:text-gray-300 text-sm">← Platform</Link>
        <h1 className="text-2xl font-bold text-white mt-2">Onboarding Guide</h1>
        <p className="text-gray-400 text-sm mt-1">
          Everything that happens when a new school signs up and sets up SubHub.
          Keep this updated whenever the onboarding flow changes.
        </p>
      </div>

      {/* Phase 1: Signup */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Phase 1 — Signup</h2>
        <div className="rounded-lg border border-gray-700 bg-gray-900 divide-y divide-gray-800">
          <Step n="1" title="Admin visits substitutes.us and clicks Start Free Trial" />
          <Step n="2" title="Fills out signup form" detail="First name, last name, email, school name, password." />
          <Step n="3" title="System provisions the org" detail={
            <>Account created instantly via <code className="text-indigo-300 text-xs">provisionSelfSignupOrg()</code>: org row inserted, subscription status = trial (120 days), cronEnabled = false, onboardingCompletedAt = null.</>
          } />
          <Step n="4" title="IT staff alert email sent" detail="Notifies jessegentile@gmail.com that a new school signed up. Includes school name, admin name, email." />
          <Step n="5" title="Admin confirms their email" detail="Supabase sends a confirmation link. Admin clicks it and lands on the dashboard — but is immediately redirected to the onboarding wizard because onboardingCompletedAt is null." />
        </div>
      </section>

      {/* Phase 2: Onboarding wizard */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Phase 2 — Onboarding Wizard</h2>
        <div className="rounded-lg border border-gray-700 bg-gray-900 divide-y divide-gray-800">
          <Step n="Step 1" title="Org settings" detail="Timezone, pay model (block/hourly), notification channels (email/SMS/phone), district name." />
          <Step n="Step 2" title="Campuses & schools" detail="Add at least one campus (physical address — search CA directory or enter manually). Add one or more school names per campus (e.g. Elementary, Middle, High)." />
          <Step n="Step 3" title="Billing" detail={
            <>
              Set seat count and billing contact (name + email). Choose one of three billing paths:
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-400 text-xs">
                <li><strong className="text-gray-300">Option A — Send bill:</strong> Admin uploads their current software bill. IT staff notified to manually invoice. paymentMethod set to &apos;check&apos;.</li>
                <li><strong className="text-gray-300">Option B — 25% off:</strong> Stripe promo code generated automatically (e.g. SAVE25-SCHOOLNAME). IT staff notified to send the code to the billing contact. Code stored in org.planNotes.</li>
                <li><strong className="text-gray-300">Option C — 3 months free:</strong> Redirects to Stripe Checkout with a 90-day trial coupon. On completion, stripeCustomerId and stripeSubscriptionId saved; subscription activated email sent.</li>
              </ul>
            </>
          } />
          <Step n="Step 4" title="Finish" detail={
            <>
              Admin clicks Finish. <code className="text-indigo-300 text-xs">completeOnboarding()</code> stamps onboardingCompletedAt = now(). Onboarding confirmation email sent to all admins + billing contact (school name, schools, seat count, monthly rate, what to expect). Admin redirected to /dashboard.
            </>
          } />
        </div>
      </section>

      {/* Phase 3: Post-onboarding checklist */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Phase 3 — Post-Onboarding Setup (dashboard checklist)</h2>
        <p className="text-gray-500 text-sm">Admin sees a fuchsia checklist on their dashboard until all three are done.</p>
        <div className="rounded-lg border border-gray-700 bg-gray-900 divide-y divide-gray-800">
          <Step n="Step 4" title="Configure each school's times" detail="Admin sets day start and end time for each school. No defaults — must be explicitly entered. schools.timesConfigured = true once saved." />
          <Step n="Step 5" title="Import teachers" detail="CSV upload (first name, last name, email, role, school). Teachers receive a Supabase invite email with a link to set their password. They must confirm to activate their account." />
          <Step n="Step 6" title="Import substitutes" detail={
            <>
              CSV upload (same fields). Two modes:
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-400 text-xs">
                <li><strong className="text-gray-300">Send invites (ON):</strong> Supabase sends an invite email; sub sets password on first login.</li>
                <li><strong className="text-gray-300">Silent import (OFF):</strong> Account created immediately. SubHub sends a welcome email telling the sub to use Forgot Password to log in.</li>
              </ul>
              Subs are automatically assigned to the selected school and entered into the blast pool.
            </>
          } />
        </div>
      </section>

      {/* Phase 4: Go live */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Phase 4 — Live Operation</h2>
        <div className="rounded-lg border border-gray-700 bg-gray-900 divide-y divide-gray-800">
          <Step n="A" title="cronEnabled must be true for blasts to fire" detail="Set automatically when a school completes Stripe checkout (Option C). For check/invoice payers (Options A/B), IT staff must manually toggle it ON from the platform org page once payment is arranged." />
          <Step n="B" title="Evening blast — 9:00 PM local" detail="Dispatcher finds tomorrow's approved unfilled absences. Notifies all assigned subs simultaneously via email + SMS + phone call. Each school fires at 9pm in its own timezone." />
          <Step n="C" title="Morning blast — 6:00 AM local" detail="Re-notifies subs for any still-unfilled positions from the evening blast or newly submitted that morning." />
          <Step n="D" title="Reblast — 6:20 AM local" detail="Sends a second round to any subs who haven't explicitly declined." />
          <Step n="E" title="Unfilled alert — 6:30 AM local" detail="Emails the admin if any positions are still unfilled. Admin can assign a sub manually." />
          <Step n="F" title="Completion — 5:30 PM local" detail="Stamps completedAt on absences whose last day ended today. Marks sub assignments as completed." />
        </div>
      </section>

      {/* Phase 5: Ongoing billing */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Phase 5 — Ongoing Billing</h2>
        <div className="rounded-lg border border-gray-700 bg-gray-900 divide-y divide-gray-800">
          <Step n="G" title="Monthly Stripe renewal" detail="Stripe charges the card on file each month. invoice.paid webhook fires → paidThrough updated → payment received email sent to admin + billing contact." />
          <Step n="H" title="Daily seat check — 7am UTC (midnight PST)" detail={
            <>
              Once per day, the system compares active teacher count to purchased seatCount for every org.
              If they diverge:
              <ul className="mt-2 space-y-1 list-disc list-inside text-gray-400 text-xs">
                <li>Email sent to admin + billing contact with old vs new count and 48h deadline</li>
                <li>Billing page shows amber &apos;Seat count update pending&apos; card</li>
                <li>Admin can click Commit Now (or set a custom count) at any time</li>
                <li>After 48 hours with no action: auto-commits, updates Stripe quantity, sends confirmation email</li>
              </ul>
              Admin can add/remove teachers freely all day — only one email fires capturing the net change.
            </>
          } />
          <Step n="I" title="Trial reminders" detail="14-day and 3-day emails fire automatically from the daily billing-alerts cron. Expired trial locks access and disables notifications until payment is received." />
        </div>
      </section>

      {/* Emails triggered */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">All Automated Emails — Quick Reference</h2>
        <p className="text-gray-500 text-xs">All emails use the logo from platform_settings.logoUrl and pull school name, admin name, seat count, and pricing from live DB data. See <Link href="/platform/emails" className="text-indigo-400 hover:text-indigo-200">Email Reference</Link> for full details.</p>
        <div className="rounded-lg border border-gray-700 bg-gray-900 divide-y divide-gray-800 text-sm">
          <EmailRow trigger="Signup" recipient="IT staff" subject="New signup alert" />
          <EmailRow trigger="Option A or B chosen" recipient="IT staff" subject="Discount Request (Option A/B)" detail="Platform org page shows yellow action card with promo code." />
          <EmailRow trigger="Wizard complete" recipient="All admins + billing contact" subject="SubHub is ready for [School]" />
          <EmailRow trigger="Stripe checkout complete" recipient="All admins + billing contact" subject="Your SubHub subscription is active" />
          <EmailRow trigger="Silent sub import" recipient="Each sub imported" subject="You've been added as a substitute at [School]" />
          <EmailRow trigger="Invite sub import" recipient="Each sub imported" subject="(Supabase invite email)" detail="Standard Supabase invite — admin can resend from Manage Users." />
          <EmailRow trigger="Monthly Stripe renewal" recipient="All admins + billing contact" subject="Payment received — SubHub [School]" />
          <EmailRow trigger="Teacher count diverges from seats" recipient="All admins + billing contact" subject="Seat count update — action needed" detail="Once daily at 7am UTC max. 48h window to commit." />
          <EmailRow trigger="Seat count committed" recipient="All admins + billing contact" subject="SubHub plan updated — X seats" />
          <EmailRow trigger="Trial ending (14d / 3d)" recipient="Org admin" subject="Trial ending reminder" />
          <EmailRow trigger="Evening/morning blast" recipient="Assigned subs" subject="Sub request — [School] on [Date]" detail="Email + SMS + phone call per org notification settings." />
          <EmailRow trigger="Sub accepts position" recipient="The accepting sub" subject="Confirmed: Sub position at [School]" />
        </div>
      </section>

      <p className="text-xs text-gray-600 pb-8">
        Last updated: 2026-06-23. Update this page whenever onboarding flow changes.
        See <Link href="/platform/emails" className="text-indigo-500 hover:text-indigo-300">Email Reference</Link> for full details on every automated email in the system.
      </p>
    </div>
  )
}

function Step({ n, title, detail }: { n: string; title: string; detail?: React.ReactNode }) {
  return (
    <div className="px-5 py-4 flex gap-4">
      <span className="text-xs font-mono text-indigo-500 w-12 flex-shrink-0 pt-0.5">{n}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{title}</p>
        {detail && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{detail}</p>}
      </div>
    </div>
  )
}

function EmailRow({ trigger, recipient, subject, detail }: { trigger: string; recipient: string; subject: string; detail?: string }) {
  return (
    <div className="px-5 py-3 grid grid-cols-3 gap-4 text-xs">
      <span className="text-indigo-400">{trigger}</span>
      <span className="text-gray-300">{subject}</span>
      <div>
        <span className="text-gray-500">→ {recipient}</span>
        {detail && <p className="text-gray-600 mt-0.5">{detail}</p>}
      </div>
    </div>
  )
}
