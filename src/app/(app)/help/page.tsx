/**
 * Admin / Principal help page.
 * Add a new section here whenever a new admin feature is built.
 */

import { HelpCircle } from 'lucide-react'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">{title}</h2>
      <div className="space-y-3 text-sm text-gray-700 leading-relaxed">{children}</div>
    </section>
  )
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal list-inside space-y-1.5 pl-1">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ol>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-blue-800 text-sm">
      <span className="font-semibold">Tip: </span>{children}
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-yellow-50 border border-yellow-100 px-4 py-3 text-yellow-800 text-sm">
      <span className="font-semibold">Note: </span>{children}
    </div>
  )
}

const toc = [
  { id: 'getting-started',  label: 'Getting Started' },
  { id: 'managing-users',   label: 'Managing Users' },
  { id: 'creating-absence', label: 'Creating an Absence' },
  { id: 'approving',        label: 'Approving Absences' },
  { id: 'finding-sub',      label: 'Finding a Substitute' },
  { id: 'reconcile',        label: 'Reconciling Assignments' },
  { id: 'settings',         label: 'Settings' },
  { id: 'schools',          label: 'Schools' },
]

export default function AdminHelpPage() {
  return (
    <div className="max-w-3xl space-y-8">

      {/* Header */}
      <div className="flex items-start gap-3">
        <HelpCircle className="h-8 w-8 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Help Guide</h1>
          <p className="text-gray-500 mt-1">Everything you need to manage absences and substitutes in SubHub.</p>
        </div>
      </div>

      {/* Table of contents */}
      <nav className="rounded-lg border border-gray-200 bg-white px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">On this page</p>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {toc.map(({ id, label }) => (
            <li key={id}>
              <a href={`#${id}`} className="text-sm text-blue-600 hover:underline">{label}</a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Getting Started ── */}
      <Section id="getting-started" title="Getting Started">
        <p>When you first log in, your dashboard shows a <strong>setup checklist</strong> with three steps. Complete these before you start using SubHub day-to-day:</p>
        <Steps items={[
          'Configure your school — add a phone number and address so substitutes know where to go.',
          'Invite your teachers — teachers need accounts to submit absence requests.',
          'Add substitutes — subs need accounts to receive job notifications.',
        ]} />
        <p>The checklist disappears automatically once all three steps are done.</p>
        <Tip>Your dashboard shows today's absences and upcoming absences at a glance. Use it as your daily starting point.</Tip>
      </Section>

      {/* ── Managing Users ── */}
      <Section id="managing-users" title="Managing Users">
        <p>Go to <strong>Admin → Manage Users</strong> to invite, edit, or deactivate teachers, staff, and substitutes.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Inviting a single person</h3>
        <Steps items={[
          'Fill in first name, last name, and email.',
          'Choose their role (Teacher, Substitute, Staff, or Admin).',
          'For Teachers and Staff, select their school — this is required.',
          'Click Send Invite. The person receives an email with a link to set their password.',
        ]} />

        <h3 className="font-semibold text-gray-800 mt-4">Bulk import from CSV</h3>
        <p>To add many people at once, use the <strong>Bulk import from CSV</strong> toggle below the invite form.</p>
        <Steps items={[
          'Download the template CSV and fill it in. Required columns: First Name, Last Name, Email. Optional: Phone.',
          'Select the role and school for the whole batch.',
          'Upload the file. Review the preview — you can remove individual rows before sending.',
          'Choose whether to send invite emails or do a silent import.',
        ]} />
        <Note>
          <strong>Send invites</strong> emails each person a link to set their password.{' '}
          <strong>Silent import</strong> creates their accounts immediately — tell them to go to the app and use "Forgot Password" with their school email to log in. Silent import is often easier for onboarding a whole staff at once.
        </Note>

        <h3 className="font-semibold text-gray-800 mt-4">Resending an invite</h3>
        <p>If someone's invite expired (7-day window) or they can't find the email, click <strong>Resend</strong> next to their name in the Pending Invites section. This cancels the old link and sends a fresh one.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Editing a user</h3>
        <p>Click <strong>Edit</strong> next to any user to update their name, email, phone number, or role. You can also update their profile photo from here.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Deactivating a user</h3>
        <p>Deactivating a user prevents them from logging in but keeps their history. Use this instead of deleting when someone leaves — it preserves their absence records.</p>
      </Section>

      {/* ── Creating an Absence ── */}
      <Section id="creating-absence" title="Creating an Absence">
        <p>Absences can be created by admins/staff (on behalf of a teacher) or by teachers themselves. To create one as an admin, click <strong>Create Absence</strong> from the dashboard or the sidebar.</p>
        <Steps items={[
          'Select the teacher.',
          'Enter the absence dates. For a single day, leave the end date blank. For multiple days, set both start and end dates.',
          'Set the start and end times (defaults to the school day times).',
          'Choose whether a substitute is required.',
          'Optionally select a reason and add notes for the substitute.',
          'If you already have a substitute in mind, you can request a specific sub.',
          'Submit — the absence is created with "Pending Approval" status.',
        ]} />
        <Tip>Notes to the substitute (lesson plans, seating charts, class schedule) are shown in the notification email the sub receives. Use this field — it helps subs feel prepared and reduces day-of confusion.</Tip>
      </Section>

      {/* ── Approving Absences ── */}
      <Section id="approving" title="Approving Absences">
        <p>Go to <strong>Approve Absences</strong> to review pending requests. Absences submitted by teachers start as "Pending Approval" — they need your sign-off before subs are notified.</p>
        <Steps items={[
          'Click an absence to open its detail page.',
          'Review the details.',
          'Click Approve to confirm, or Deny to reject the request.',
        ]} />
        <Note>Approving an absence does not automatically notify substitutes. You still need to go to Find Substitute and either assign a sub manually or click "Notify All Subs."</Note>
      </Section>

      {/* ── Finding a Substitute ── */}
      <Section id="finding-sub" title="Finding a Substitute">
        <p>Go to <strong>Find Substitute</strong> to see all approved absences that still need a sub. Click an absence to open its detail page.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Assign a sub manually</h3>
        <p>Use the dropdown to select a specific substitute and click Assign. The sub is booked immediately with no notification sent.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Notify All Subs</h3>
        <p>Click <strong>Notify All Subs</strong> to blast a notification to all eligible substitutes in priority order. Each sub receives a unique email (and optionally SMS or phone call) with Accept and Decline links.</p>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li>Subs who marked themselves unavailable on that date are skipped.</li>
          <li>Subs excluded from your school are skipped.</li>
          <li>The first sub to click Accept gets the job — all other tokens expire.</li>
          <li>Priority order is set in Settings.</li>
        </ul>
        <Tip>You can control which notification channels are used (email, SMS, phone call) in Settings → Notifications.</Tip>
      </Section>

      {/* ── Reconciling ── */}
      <Section id="reconcile" title="Reconciling Assignments">
        <p>Go to <strong>Reconcile</strong> after absences are complete to confirm the sub's hours for payroll. This is where you verify that what was scheduled matches what actually happened.</p>
        <Steps items={[
          'Review each completed assignment.',
          'Confirm the hours are correct.',
          'Mark as reconciled.',
        ]} />
        <Note>Reconciliation details (exact hour adjustments, sub ratings) are coming in a future update.</Note>
      </Section>

      {/* ── Settings ── */}
      <Section id="settings" title="Settings">
        <p>Go to <strong>Settings</strong> to configure how SubHub notifies substitutes.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Auto-notify</h3>
        <p>When enabled, SubHub automatically sends notifications to subs as soon as an absence is approved. When disabled, you manually trigger the blast from the Find Substitute page.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Notification channels</h3>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li><strong>Email</strong> — sends each sub an email with Accept/Decline links. On by default.</li>
          <li><strong>SMS</strong> — sends a text message with Accept/Decline links. Requires subs to have a phone number on file.</li>
          <li><strong>Phone call</strong> — calls the sub and reads out the job details. Press 1 to accept, Press 2 to decline. Off by default.</li>
        </ul>

        <h3 className="font-semibold text-gray-800 mt-4">Sub priority order</h3>
        <p>Drag substitutes into your preferred calling order. When a blast goes out, subs higher on the list are notified first. Subs not in the list are notified after ranked subs, in no particular order.</p>
      </Section>

      {/* ── Schools ── */}
      <Section id="schools" title="Schools">
        <p>Go to <strong>Admin → Schools</strong> to manage your school's contact information.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Configuring your school</h3>
        <p>Click Edit on your school to set the address, phone, website, and school day start/end times. The start and end times are used as defaults when creating absences.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Claiming from the school directory</h3>
        <p>SubHub includes a directory of California public schools. Click <strong>Find in directory</strong> to search for your school and import its address, phone, and county automatically. This also makes your school visible to substitutes browsing the directory.</p>
      </Section>

    </div>
  )
}
