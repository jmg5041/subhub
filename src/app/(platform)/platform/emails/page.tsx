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
        trigger: 'Monthly invoice (check/invoice payers)',
        when: '1st of each month — daily cron',
        to: 'Org admin + IT staff',
        subject: 'SubHub Invoice — $X due for [Month Year]',
        notes: 'Shows seat count × price. IT staff receives a copy.',
      },
      {
        trigger: 'Payment failed (credit card)',
        when: '1st of each month — only for past_due CC orgs',
        to: 'Org admin',
        subject: 'Action required: Update your SubHub payment method',
        notes: 'Links to billing page to update card.',
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
        notes: 'Includes current software name, annual cost, seat count, admin email. Action: send promo code.',
      },
      {
        trigger: 'Option B: 25% off request',
        when: 'Immediately when submitted during onboarding',
        to: 'IT staff',
        subject: 'Discount Request (Option B — 25% Off): [School]',
        notes: 'Includes seat count, full rate, discounted rate. Action: send SAVE25 promo code.',
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
        trigger: 'Job available (blast)',
        when: 'Evening ~5pm and morning ~6am local time — QStash dispatcher, per org',
        to: 'Eligible subs for that school (in priority order)',
        subject: 'Substitute job available — [School Name]',
        notes: 'Email + optional SMS + optional phone call. cronEnabled must be true.',
      },
      {
        trigger: 'Re-blast',
        when: 'Configurable interval after initial blast if still unfilled',
        to: 'Remaining eligible subs',
        subject: 'Still available: substitute job at [School Name]',
        notes: 'Only fires if job still unfilled after initial blast.',
      },
      {
        trigger: 'Unfilled alert',
        when: 'If absence is still unfilled by a configured threshold',
        to: 'Org admin',
        subject: 'Heads up: unfilled absence at [School]',
        notes: 'Prompts admin to manually find coverage.',
      },
    ],
  },
  {
    category: 'User Invitations',
    entries: [
      {
        trigger: 'User invited (Send invite emails ON)',
        when: 'Immediately on invite or bulk import with invites enabled',
        to: 'Invited person',
        subject: 'You\'ve been invited to SubHub',
        notes: 'Sent by Supabase Auth. Link expires in 7 days. Use Resend button to re-send.',
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
