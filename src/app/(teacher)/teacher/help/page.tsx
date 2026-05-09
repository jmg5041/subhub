/**
 * Teacher help page.
 * Add a new section here whenever a new teacher feature is built.
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
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'submitting',      label: 'Submitting an Absence' },
  { id: 'status',          label: 'Understanding Absence Status' },
  { id: 'managing',        label: 'Managing Your Requests' },
  { id: 'profile',         label: 'Your Profile' },
]

export default function TeacherHelpPage() {
  return (
    <div className="max-w-3xl space-y-8">

      {/* Header */}
      <div className="flex items-start gap-3">
        <HelpCircle className="h-8 w-8 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher Help Guide</h1>
          <p className="text-gray-500 mt-1">How to submit and manage absence requests in SubHub.</p>
        </div>
      </div>

      {/* Table of contents */}
      <nav className="rounded-lg border border-gray-200 bg-white px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">On this page</p>
        <ul className="space-y-1.5">
          {toc.map(({ id, label }) => (
            <li key={id}>
              <a href={`#${id}`} className="text-sm text-blue-600 hover:underline">{label}</a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Getting Started ── */}
      <Section id="getting-started" title="Getting Started">
        <p>Your school administrator has added you to SubHub. Here's how to log in for the first time:</p>

        <h3 className="font-semibold text-gray-800 mt-4">If you received an invite email</h3>
        <Steps items={[
          'Open the email from SubHub and click the link.',
          'You\'ll be prompted to set your password.',
          'Once your password is set, you\'ll land on your teacher dashboard.',
        ]} />

        <h3 className="font-semibold text-gray-800 mt-4">If your admin added you without an invite email</h3>
        <Steps items={[
          `Go to ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'} and click "Forgot Password."`,
          'Enter your school email address.',
          'Check your email for a password reset link and click it.',
          'Set your password — you\'re in.',
        ]} />

        <Tip>Use the same email address your school has on file. If the forgot password email doesn't arrive, check your spam folder.</Tip>
      </Section>

      {/* ── Submitting an Absence ── */}
      <Section id="submitting" title="Submitting an Absence Request">
        <p>Click <strong>Submit Request</strong> in the sidebar (or from your home page) to report an upcoming absence.</p>
        <Steps items={[
          'Select the date of your absence. For multiple consecutive days, check "Multi-day absence" and set the end date.',
          'Set the start and end times. These default to your school\'s day start and end times.',
          'Choose whether a substitute is needed.',
          'Select a reason (optional).',
          'Add notes for the substitute — lesson plans, seating charts, class schedule, anything helpful.',
          'If you\'d like a specific substitute, use the "Request specific sub" field.',
          'Click Submit.',
        ]} />
        <Note>Submitting a request does not immediately book a substitute. Your admin reviews and approves the request first, then arranges coverage.</Note>
        <Tip>The more detail you put in the Notes to Substitute field, the smoother your class day will go. Include where materials are, any class rules to emphasize, and what students should be working on.</Tip>
      </Section>

      {/* ── Understanding Status ── */}
      <Section id="status" title="Understanding Absence Status">
        <p>Each absence request moves through several statuses. Here's what each one means:</p>
        <div className="space-y-2">
          <div className="flex gap-3">
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700 flex-shrink-0">Pending approval</span>
            <span>Your request has been submitted and is waiting for your admin to review it.</span>
          </div>
          <div className="flex gap-3">
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 flex-shrink-0">No sub needed</span>
            <span>Your absence was approved and your admin confirmed no substitute is required.</span>
          </div>
          <div className="flex gap-3">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 flex-shrink-0">Subs notified</span>
            <span>Your absence was approved and substitutes have been contacted. Waiting for someone to accept.</span>
          </div>
          <div className="flex gap-3">
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 flex-shrink-0">Sub assigned</span>
            <span>A substitute has accepted the job. Coverage is confirmed.</span>
          </div>
        </div>
      </Section>

      {/* ── Managing Requests ── */}
      <Section id="managing" title="Managing Your Requests">
        <p>Go to <strong>My Absences</strong> to see all your past and upcoming absence requests.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Canceling a request</h3>
        <p>You can cancel a request as long as no substitute has already accepted the job. Open the request and click Delete. Once a sub has been assigned, contact your admin to make changes.</p>

        <Note>You cannot edit a request after it's been submitted — only delete and resubmit. If you need to change the dates or times, delete the existing request and create a new one.</Note>
      </Section>

      {/* ── Profile ── */}
      <Section id="profile" title="Your Profile">
        <p>Go to <strong>My Profile</strong> to update your profile photo.</p>
        <Steps items={[
          'Click "Change photo" or tap the camera icon on your avatar.',
          'Select a photo from your device. SubHub automatically resizes it.',
          'Your photo saves immediately and appears in the sidebar.',
        ]} />
      </Section>

    </div>
  )
}
