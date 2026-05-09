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
  { id: 'managing-subs',    label: 'Managing Substitutes' },
  { id: 'hire-subs',        label: 'Hiring Substitutes' },
  { id: 'creating-absence', label: 'Creating an Absence' },
  { id: 'approving',        label: 'Approving Absences' },
  { id: 'finding-sub',      label: 'Finding a Substitute' },
  { id: 'partial-day',      label: 'Partial-Day Assignments' },
  { id: 'reconcile',        label: 'Reconciling Sub Hours' },
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
        <Tip>Your dashboard shows today&apos;s absences and upcoming absences at a glance. Use it as your daily starting point.</Tip>
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
          <strong>Silent import</strong> creates their accounts immediately — tell them to go to the app and use &quot;Forgot Password&quot; with their school email to log in. Silent import is often easier for onboarding a whole staff at once.
        </Note>

        <h3 className="font-semibold text-gray-800 mt-4">Resending an invite</h3>
        <p>If someone&apos;s invite expired (7-day window) or they can&apos;t find the email, click <strong>Resend</strong> next to their name in the Pending Invites section. This cancels the old link and sends a fresh one.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Editing a user</h3>
        <p>Click <strong>Edit</strong> next to any user to update their name, email, phone number, or role. You can also update their profile photo from here.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Deactivating a user</h3>
        <p>Deactivating a user prevents them from logging in but keeps their history. Use this instead of deleting when someone leaves — it preserves their absence records.</p>
      </Section>

      {/* ── Managing Substitutes ── */}
      <Section id="managing-subs" title="Managing Substitutes">
        <p>Go to <strong>Substitutes → Manage &amp; Review</strong> to see your full sub roster and manage school assignments and call priority.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Sub Roster tab</h3>
        <p>Shows all substitutes in your organization with their contact info, county, assigned schools, rating, and resume. Active subs are listed at the top; inactive subs appear dimmed below.</p>
        <p className="mt-2">Click any sub&apos;s name to open their detail page where you can:</p>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li>View their contact info, county, rating, and resume.</li>
          <li>Assign them to one or more schools using the <strong>School Assignments</strong> checkboxes.</li>
        </ul>
        <Tip>Assigning a sub to a school is what makes them appear in that school&apos;s Call Priority list and makes them eligible to be called for absences at that campus.</Tip>

        <h3 className="font-semibold text-gray-800 mt-4">Call Priority Order tab</h3>
        <p>Sets the order in which subs are called when a job notification goes out for each campus.</p>
        <Steps items={[
          'Click a school name to open its priority list.',
          'Only subs assigned to that school appear in the list.',
          'Use the arrows to move subs up or down.',
          'Click Save Priority Order when done.',
        ]} />
        <p>Subs at the top of the list are notified first. If no priority order is saved, subs are notified in no particular order.</p>
        <Note>A school must have subs assigned to it before a priority order can be set. Assign subs from their detail page first.</Note>
      </Section>

      {/* ── Hiring Substitutes ── */}
      <Section id="hire-subs" title="Hiring Substitutes">
        <p>Go to <strong>Substitutes → Hire Subs</strong> to review join requests from substitutes and browse the SubHub substitute directory.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Join requests</h3>
        <p>When a substitute visits your school&apos;s profile page and clicks <strong>Request to Join</strong>, a pending request appears at the top of the Hire Subs page. A badge on the sidebar shows how many requests are waiting.</p>
        <Steps items={[
          'Expand a pending request to see the sub\'s contact info.',
          'Select which schools to assign them to (you can assign to multiple campuses at once).',
          'Click Approve — the sub is immediately added to those schools\' rosters.',
          'Or click Decline to reject the request.',
        ]} />

        <h3 className="font-semibold text-gray-800 mt-4">Browse the directory</h3>
        <p>Use <strong>Browse Substitute Directory</strong> to find substitutes registered in SubHub by county. This shows all subs across all schools — not just yours. Once you find someone, you can invite them through <strong>Admin → Manage Users</strong>.</p>
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
        <p>Go to <strong>Approve Absences</strong> to review pending requests. Absences submitted by teachers start as &quot;Pending Approval&quot; — they need your sign-off before subs are notified.</p>
        <Steps items={[
          'Click an absence to open its detail page.',
          'Review the details.',
          'Click Approve to confirm, or Deny to reject the request.',
        ]} />
        <Note>Approving an absence does not automatically notify substitutes. You still need to go to Find Substitute and either assign a sub manually or click &quot;Notify All Subs.&quot;</Note>
      </Section>

      {/* ── Finding a Substitute ── */}
      <Section id="finding-sub" title="Finding a Substitute">
        <p>Go to <strong>Find Substitute</strong> (sidebar) to see all approved absences that still need coverage. Click any absence to open its detail page.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Option 1 — Notify All Subs</h3>
        <p>Click <strong>Send Notification to All Subs</strong> to blast a notification to every eligible substitute in priority order. Each sub receives a unique email (and optionally SMS or phone call) with Accept and Decline links. The first sub to click Accept gets the job.</p>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li>Subs who marked themselves unavailable on that date are automatically skipped.</li>
          <li>Subs excluded from your school are skipped.</li>
          <li>Notification tokens expire after 48 hours.</li>
          <li>Priority order is set per campus under <strong>Manage &amp; Review → Call Priority Order</strong>.</li>
          <li>Only subs assigned to the absence&apos;s school are eligible to be called.</li>
        </ul>

        <h3 className="font-semibold text-gray-800 mt-4">Option 2 — Assign a Specific Sub</h3>
        <p>Click <strong>Choose a Substitute</strong>, search by name, select a sub, and click <strong>Assign This Sub</strong>. The sub is booked immediately — no notification is sent. Use this when you&apos;ve already arranged coverage by phone.</p>
        <Tip>If the absence is less than a full school day, SubHub will ask how to record the sub&apos;s hours before you confirm. See the Partial-Day Assignments section below.</Tip>

        <h3 className="font-semibold text-gray-800 mt-4">Option 3 — Covered by Staff</h3>
        <p>Toggle <strong>Covered by Staff</strong> if another teacher, an aide, or an administrator is covering the class. No sub is needed and no notification is sent. The absence is still tracked for records.</p>
      </Section>

      {/* ── Partial-Day Assignments ── */}
      <Section id="partial-day" title="Partial-Day Assignments">
        <p>When you assign a sub to an absence that is shorter than a full school day, SubHub shows a prompt asking how to record the sub&apos;s time. This matters for accurate payroll — a sub may be on campus longer than just the absence they&apos;re filling.</p>

        <p className="mt-3">You have five choices:</p>

        <div className="space-y-3 mt-2">
          <div>
            <p className="font-semibold text-gray-800">Exact hours</p>
            <p>The sub is credited only for the duration of the absence. Use this when the sub truly works only those hours and leaves.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">Half day</p>
            <p>The sub is credited for your school&apos;s standard half-day block (default: 4 hours), regardless of exact absence length. Use this when your school pays subs in half-day increments.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">Full day</p>
            <p>The sub is credited for a full school day (default: 8 hours). Use this when the sub is on campus all day even if only covering a partial absence.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">Combine with another absence today</p>
            <p>If another teacher is also out that day (at a different time with no overlap), you can bundle both absences into one shift for the same sub. SubHub shows eligible absences as a checklist — select them and the sub&apos;s total hours update automatically. This eliminates the need for a separate spreadsheet to track split-day sub work.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">General duties for remaining time</p>
            <p>The sub fills the absence, then stays on campus for the rest of a half or full day doing non-classroom work — lunchroom supervision, PE yard duty, front office coverage, etc. Enter a short description of the duties. The sub&apos;s total hours include both the absence coverage and the general duty time.</p>
          </div>
        </div>

        <div className="mt-3">
          <p>A live <strong>hours preview</strong> at the bottom of the panel updates as you make selections so you always see what the sub will be credited before you confirm.</p>
        </div>

        <Note>The &quot;Combine&quot; and &quot;General duties&quot; options solve the problem of a sub who covers multiple teachers in one day being under-credited. Without these options, payroll would only see the hours for one teacher&apos;s absence — not the sub&apos;s actual full day.</Note>

        <h3 className="font-semibold text-gray-800 mt-4">Setting your pay model</h3>
        <p>Go to <strong>Settings → Sub Pay Model</strong> to choose how your school records sub hours:</p>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li><strong>Block (default)</strong> — subs are paid in half-day or full-day blocks. The partial-day prompt appears whenever an absence is shorter than a full day.</li>
          <li><strong>Hourly</strong> — subs are paid for exact hours worked. No prompt appears; hours are calculated automatically from the absence start and end times.</li>
        </ul>
        <p className="mt-2">You can also change the default half-day and full-day hour values (e.g., if your school day is 6 hours, set full day to 6 and half day to 3).</p>
      </Section>

      {/* ── Reconciling ── */}
      <Section id="reconcile" title="Reconciling Sub Hours">
        <p>Go to <strong>Reconcile Sub Hours</strong> (Substitutes section of the sidebar) after absences are complete to verify what actually happened before payroll is processed.</p>
        <p className="mt-2">Reconciling answers: <em>Did the sub show up? Did the hours match what was scheduled?</em></p>
        <Steps items={[
          'Review each completed assignment.',
          'Confirm the sub worked as assigned — or note if they didn\'t show or hours differed.',
          'Mark as reconciled.',
        ]} />

        <h3 className="font-semibold text-gray-800 mt-4">What reconciliation covers</h3>
        <div className="space-y-2">
          <div className="flex gap-2"><span className="text-gray-400">→</span><span>Sub worked exactly as assigned — confirm and done.</span></div>
          <div className="flex gap-2"><span className="text-gray-400">→</span><span>Sub covered one teacher&apos;s absence and general duties — total hours already recorded at assign time.</span></div>
          <div className="flex gap-2"><span className="text-gray-400">→</span><span>Sub covered two teachers in one combined shift — hours already summed at assign time, both teacher absence records linked.</span></div>
          <div className="flex gap-2"><span className="text-gray-400">→</span><span>Sub left early or the teacher came back — adjust hours at reconcile time (coming in a future update).</span></div>
          <div className="flex gap-2"><span className="text-gray-400">→</span><span>Sub didn&apos;t show — mark accordingly (coming in a future update).</span></div>
        </div>

        <Note>Sub ratings and manual hour adjustments at reconcile time are planned for the next update. For now, reconciliation is a confirmation step — the hour corrections are handled at assign time using the partial-day options above.</Note>
      </Section>

      {/* ── Settings ── */}
      <Section id="settings" title="Settings">
        <p>Go to <strong>Settings</strong> to configure notifications and sub pay preferences.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Auto-notify</h3>
        <p>When enabled, SubHub automatically sends notifications to subs as soon as an absence is approved. When disabled, you manually trigger the blast from the Find Substitute page.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Notification channels</h3>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li><strong>Email</strong> — sends each sub an email with Accept/Decline links. On by default.</li>
          <li><strong>SMS</strong> — sends a text message with Accept/Decline links. Requires subs to have a phone number on file.</li>
          <li><strong>Phone call</strong> — calls the sub and reads out the job details. Press 1 to accept, Press 2 to decline. Off by default.</li>
        </ul>

        <h3 className="font-semibold text-gray-800 mt-4">Sub pay model</h3>
        <p>Choose whether your school pays subs in <strong>blocks</strong> (half day / full day) or by <strong>exact hours</strong>. Set the number of hours that count as a half day and a full day for your school. See the Partial-Day Assignments section above for how this affects the assign flow.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Sub priority order</h3>
        <p>Call priority is managed per campus under <strong>Substitutes → Manage &amp; Review → Call Priority Order</strong>. See the Managing Substitutes section above.</p>
      </Section>

      {/* ── Schools ── */}
      <Section id="schools" title="Schools">
        <p>Go to <strong>Admin → Schools</strong> to manage your school&apos;s contact information.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Configuring your school</h3>
        <p>Click Edit on your school to set the address, phone, website, and school day start/end times. The start and end times are used as defaults when creating absences.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Claiming from the school directory</h3>
        <p>SubHub includes a directory of California public schools. Click <strong>Find in directory</strong> to search for your school and import its address, phone, and county automatically. This also makes your school visible to substitutes browsing the directory.</p>
      </Section>

    </div>
  )
}
