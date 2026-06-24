import { getPlatformContext } from '../actions'
import Link from 'next/link'

type EmailEntry = {
  trigger: string
  when: string
  to: string
  subject: string
  notes?: string
}

const emails: { category: string; entries: EmailEntry[] }[] = [
  {
    category: 'Onboarding & Signup',
    entries: [
      {
        trigger: 'New self-serve signup',
        when: 'Immediately when a new org is provisioned',
        to: 'IT staff alert email',
        subject: 'New signup: [School Name]',
        notes: 'Includes school name, admin contact, trial end date, link to platform page.',
      },
      {
        trigger: 'Onboarding wizard completed',
        when: 'Immediately when admin clicks Finish on Step 4',
        to: 'All org admins + billing contact',
        subject: 'SubHub is ready for [School Name]',
        notes: 'Summarizes schools, seat count, monthly rate, blast schedule (9pm / 6am), and next steps.',
      },
      {
        trigger: 'Stripe checkout completed (Option C)',
        when: 'Immediately via Stripe checkout.session.completed webhook',
        to: 'All org admins + billing contact',
        subject: 'Your SubHub subscription is active — [School Name]',
        notes: 'Confirms seat count, monthly charge, and first billing date.',
      },
    ],
  },
  {
    category: 'Billing — Trials',
    entries: [
      {
        trigger: 'Trial ending in 14 days',
        when: 'Daily cron (10am UTC) — fires on day 14 before trial end',
        to: 'Org admin',
        subject: 'Your SubHub trial ends in 14 days',
        notes: 'Includes seat count, monthly rate estimate, link to billing page.',
      },
      {
        trigger: 'Trial ending in 3 days',
        when: 'Daily cron (10am UTC) — fires on day 3 before trial end',
        to: 'Org admin',
        subject: 'Urgent: Your SubHub trial ends in 3 days',
        notes: 'Warns that notifications stop after expiry.',
      },
      {
        trigger: 'Trial expired',
        when: 'Daily cron (10am UTC) — fires the day after trial end',
        to: 'Org admin + IT staff (invoice payers only)',
        subject: 'Your SubHub trial has ended',
        notes: 'CC payers: card will be charged. Invoice payers: send payment to restore. IT staff gets action-needed alert for invoice payers.',
      },
      {
        trigger: '7 days overdue (invoice payers)',
        when: 'Daily cron (10am UTC) — fires 7 days after trial end if still unpaid',
        to: 'IT staff',
        subject: 'REMINDER: [School] — 7 days overdue',
        notes: 'Prompts IT to manually review and potentially flip kill switch.',
      },
    ],
  },
  {
    category: 'Billing — Active Subscriptions',
    entries: [
      {
        trigger: 'Payment received (Stripe)',
        when: 'Immediately via Stripe invoice.paid webhook — monthly renewals only (not the first payment)',
        to: 'All org admins + billing contact',
        subject: 'Payment received — SubHub [School Name]',
        notes: 'Shows amount and next charge date. First payment is covered by the subscription activated email.',
      },
      {
        trigger: 'Monthly invoice (check/invoice payers)',
        when: '1st of each month — daily cron',
        to: 'Org admin + IT staff',
        subject: 'SubHub Invoice — $X due for [Month Year]',
        notes: 'Shows seat count × price. IT staff receives a copy.',
      },
      {
        trigger: 'Payment failed (credit card)',
        when: 'Stripe invoice.payment_failed webhook',
        to: 'Org admin',
        subject: 'Action required: Update your SubHub payment method',
        notes: 'Links to billing page to update card.',
      },
    ],
  },
  {
    category: 'Billing — Seat Management',
    entries: [
      {
        trigger: 'Teacher count diverges from seat count',
        when: 'Daily cron (7am UTC / midnight PST) — net change from the previous day',
        to: 'All org admins + billing contact',
        subject: 'Seat count update for [School Name] — action needed',
        notes: 'Shows old vs new count, new monthly rate, and 48h deadline. One email per day max regardless of how many teacher changes were made.',
      },
      {
        trigger: 'Seat count committed (by admin or auto)',
        when: 'Immediately when admin clicks Commit Now, or auto at 48h deadline',
        to: 'All org admins + billing contact',
        subject: 'SubHub plan updated — X seats',
        notes: 'Confirms new seat count and monthly rate. Stripe quantity updated at same time (no proration — effective next billing cycle).',
      },
    ],
  },
  {
    category: 'Billing — Discount Requests',
    entries: [
      {
        trigger: 'Option A: School sends their bill',
        when: 'Immediately when submitted during onboarding',
        to: 'IT staff',
        subject: 'Discount Request (Option A — Send Bill): [School]',
        notes: 'Includes current software name, annual cost, seat count, admin email. Platform org page shows action card.',
      },
      {
        trigger: 'Option B: 25% off request',
        when: 'Immediately when submitted during onboarding',
        to: 'IT staff',
        subject: 'Discount Request (Option B — 25% Off): [School]',
        notes: 'Platform org page shows yellow action card with generated promo code (SAVE25-SCHOOLNAME), billing contact email, and discounted rate.',
      },
    ],
  },
  {
    category: 'Notifications Kill Switch',
    entries: [
      {
        trigger: 'Notifications turned OFF',
        when: 'Immediately — when IT flips kill switch off, or Stripe payment_failed/subscription.deleted webhook fires',
        to: 'Org admin + billing contact + IT staff',
        subject: 'Substitute notifications paused — [School Name]',
        notes: 'Explains service is paused, directs to billing page or info@substitutes.us.',
      },
    ],
  },
  {
    category: 'Email Delivery',
    entries: [
      {
        trigger: 'Email bounced or marked spam',
        when: 'Immediately — Resend webhook fires on hard bounce or complaint',
        to: 'Org admin + IT staff',
        subject: 'Email delivery failed: [Name] at [School]',
        notes: 'Flags user.emailBounced = true. Links to Manage Users to fix. Bounced users show in Notices page.',
      },
    ],
  },
  {
    category: 'Substitute Notifications',
    entries: [
      {
        trigger: 'Job available (evening blast)',
        when: '9:00 PM local school time — QStash dispatcher, per org, per timezone',
        to: 'All subs assigned to that school',
        subject: 'Sub request — [School Name] on [Date]',
        notes: 'Email + optional SMS + optional phone call (IVR). cronEnabled must be true. All subs notified simultaneously; priority calling can be enabled per school.',
      },
      {
        trigger: 'Job available (morning blast)',
        when: '6:00 AM local school time — covers new absences and any still unfilled from evening',
        to: 'All subs assigned to that school',
        subject: 'Sub request — [School Name] on [Date]',
        notes: 'Same as evening blast. Processes both not_started and sent absences.',
      },
      {
        trigger: 'Re-blast (non-decliners)',
        when: '6:20 AM local school time',
        to: 'Subs who have not explicitly declined',
        subject: 'Sub request — [School Name] on [Date]',
        notes: 'Second round — skips subs who already declined.',
      },
      {
        trigger: 'Unfilled alert',
        when: '6:30 AM local school time — if still unfilled',
        to: 'Org admin',
        subject: 'No sub yet — [Teacher] is out [Date]',
        notes: 'Prompts admin to assign a sub manually.',
      },
      {
        trigger: 'Job accepted confirmation',
        when: 'Immediately when sub accepts via email link, SMS link, or phone IVR',
        to: 'The sub who accepted',
        subject: 'Confirmed: Sub position at [School Name] on [Date]',
        notes: 'Includes school, date, time. Also contains Add to Calendar (.ics) link.',
      },
    ],
  },
  {
    category: 'User Invitations & Onboarding',
    entries: [
      {
        trigger: 'User invited (Send invite emails ON)',
        when: 'Immediately on invite or bulk import with invites enabled',
        to: 'Invited person',
        subject: 'You\'ve been invited to SubHub',
        notes: 'Sent by Supabase Auth. Link expires in 7 days. Use Resend button to re-send from Manage Users.',
      },
      {
        trigger: 'Sub silently imported (Send invite emails OFF)',
        when: 'Immediately per sub during silent CSV import',
        to: 'Each imported substitute',
        subject: 'You\'ve been added as a substitute at [School Name]',
        notes: 'Tells sub to visit app.substitutes.us and use Forgot Password to activate their account.',
      },
    ],
  },
]

export default async function PlatformEmailsPage() {
  await getPlatformContext()

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Email Reference</h1>
        <p className="text-gray-400 mt-1">Every automated email SubHub sends — trigger, timing, recipient, and notes.</p>
        <p className="text-gray-500 text-sm mt-1">
          To edit email copy, search for the subject line in the codebase.
          Key files: <code className="text-indigo-400">src/app/(platform)/platform/actions.ts</code>,{' '}
          <code className="text-indigo-400">src/app/api/cron/billing-alerts/route.ts</code>,{' '}
          <code className="text-indigo-400">src/lib/notifications.ts</code>
        </p>
      </div>

      {emails.map(({ category, entries }) => (
        <div key={category}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3">{category}</h2>
          <div className="rounded-lg overflow-hidden border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Trigger</th>
                  <th className="px-4 py-3 text-left">When</th>
                  <th className="px-4 py-3 text-left">To</th>
                  <th className="px-4 py-3 text-left">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {entries.map((e, i) => (
                  <tr key={i} className="bg-gray-900 hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3 text-white font-medium align-top">{e.trigger}</td>
                    <td className="px-4 py-3 text-gray-300 align-top text-xs">{e.when}</td>
                    <td className="px-4 py-3 text-gray-300 align-top text-xs">{e.to}</td>
                    <td className="px-4 py-3 text-gray-400 align-top text-xs">{e.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <Link href="/platform" className="inline-block text-sm text-indigo-400 hover:text-indigo-200">
        ← Back to Platform
      </Link>
    </div>
  )
}
