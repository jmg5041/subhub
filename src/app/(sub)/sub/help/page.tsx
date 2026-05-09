/**
 * Substitute help page.
 * Add a new section here whenever a new sub feature is built.
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
    <div className="rounded-lg bg-orange-50 border border-orange-100 px-4 py-3 text-orange-800 text-sm">
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
  { id: 'accepting-jobs',  label: 'Accepting & Declining Jobs' },
  { id: 'dashboard',       label: 'Your Dashboard' },
  { id: 'availability',    label: 'Setting Availability' },
  { id: 'schools',         label: 'Finding Schools' },
  { id: 'profile',         label: 'Your Profile' },
]

export default function SubHelpPage() {
  return (
    <div className="max-w-3xl space-y-8">

      {/* Header */}
      <div className="flex items-start gap-3">
        <HelpCircle className="h-8 w-8 text-orange-500 flex-shrink-0 mt-0.5" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Substitute Help Guide</h1>
          <p className="text-gray-500 mt-1">How to accept jobs, set your availability, and manage your profile in SubHub.</p>
        </div>
      </div>

      {/* Table of contents */}
      <nav className="rounded-lg border border-gray-200 bg-white px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">On this page</p>
        <ul className="space-y-1.5">
          {toc.map(({ id, label }) => (
            <li key={id}>
              <a href={`#${id}`} className="text-sm text-orange-600 hover:underline">{label}</a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Getting Started ── */}
      <Section id="getting-started" title="Getting Started">
        <p>Your school or district has added you to SubHub as a substitute teacher. Here's how to log in for the first time:</p>

        <h3 className="font-semibold text-gray-800 mt-4">If you received an invite email</h3>
        <Steps items={[
          'Open the email from SubHub and click the link.',
          'You\'ll be prompted to set your password.',
          'Once your password is set, you\'ll land on your substitute dashboard.',
        ]} />

        <h3 className="font-semibold text-gray-800 mt-4">If you were added without an invite email</h3>
        <Steps items={[
          `Go to ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'} and click "Forgot Password."`,
          'Enter the email address your school has on file for you.',
          'Check your email for a password reset link and click it.',
          'Set your password — you\'re in.',
        ]} />

        <h3 className="font-semibold text-gray-800 mt-4">First things to do</h3>
        <p>Before you start receiving job offers, complete your profile:</p>
        <Steps items={[
          'Add your phone number — required to receive text message and phone call notifications.',
          'Set your county — helps schools in your area find you.',
          'Upload your resume (optional) — helps schools know your background.',
          'Set any dates you\'re unavailable on the Availability calendar.',
        ]} />
        <Tip>If you see a yellow banner on your dashboard saying "Complete your profile," tap it to go straight to your profile page.</Tip>
      </Section>

      {/* ── Accepting Jobs ── */}
      <Section id="accepting-jobs" title="Accepting & Declining Jobs">
        <p>When a school has an open position, SubHub notifies you. You can respond three ways:</p>

        <h3 className="font-semibold text-gray-800 mt-4">From an email</h3>
        <p>You'll receive an email with the school name, date, and times. The email has two large buttons:</p>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li><strong>Accept</strong> — you're confirmed for the job immediately.</li>
          <li><strong>Decline</strong> — you pass, and other subs are still eligible.</li>
        </ul>
        <Note>Each email link is unique to you. The first substitute to click Accept gets the position. Links expire after 48 hours.</Note>

        <h3 className="font-semibold text-gray-800 mt-4">From a phone call</h3>
        <p>If your school uses phone notifications, SubHub will call you and read out the job details.</p>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li>Press <strong>1</strong> to accept the position.</li>
          <li>Press <strong>2</strong> to decline.</li>
        </ul>

        <h3 className="font-semibold text-gray-800 mt-4">From your dashboard</h3>
        <p>Open requests also appear on your dashboard under <strong>Requests Awaiting Your Response</strong>. Click the orange button next to a request to open the job page and accept or decline from there.</p>

        <Tip>Respond quickly — jobs are first-come, first-served. If you're interested in a position, accept it as soon as you see the notification.</Tip>
      </Section>

      {/* ── Dashboard ── */}
      <Section id="dashboard" title="Your Dashboard">
        <p>Your dashboard is your home base. Here's what each section shows:</p>
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-gray-800">Open Requests</p>
            <p>Jobs waiting for your response. These are time-sensitive — accept or decline as soon as you can.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">Upcoming Jobs</p>
            <p>Positions you've already accepted that haven't happened yet. Click any job to see the full details (school address, start time, notes from the teacher).</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">Past Jobs</p>
            <p>A summary of completed jobs grouped by school, including total hours worked. Click <strong>View all past jobs</strong> to see the full history with filtering by school.</p>
          </div>
        </div>
      </Section>

      {/* ── Availability ── */}
      <Section id="availability" title="Setting Availability">
        <p>Go to <strong>My Availability</strong> to mark days when you're not available to work.</p>
        <Steps items={[
          'Click any date on the calendar to mark it unavailable (shown in orange).',
          'Click the same date again to remove it.',
          'Changes save automatically.',
        ]} />
        <p>When a school sends out a job notification, SubHub automatically skips you on any date you've marked unavailable. You won't receive calls or emails for those days.</p>
        <Tip>Mark your unavailable dates as far in advance as possible. Schools send notifications as soon as an absence is approved — if you're not marked unavailable, you'll get notified even on days you can't work.</Tip>
      </Section>

      {/* ── Finding Schools ── */}
      <Section id="schools" title="Finding Schools">
        <p>Go to <strong>Find Schools</strong> to browse schools in your area. This is useful for understanding which schools you may work at.</p>
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-gray-800">Nearby</p>
            <p>Click <strong>Use my location</strong> to find schools near you, or enter a zip code to search from a specific area. Adjust the radius slider to widen or narrow the search.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">Search</p>
            <p>Search for a school by name, district, or city.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">Browse by County</p>
            <p>Select a county from the list to see all schools in that area.</p>
          </div>
        </div>
        <p>Click any school to see its address, phone number, and other details.</p>
      </Section>

      {/* ── Profile ── */}
      <Section id="profile" title="Your Profile">
        <p>Go to <strong>My Profile</strong> to keep your information up to date.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Phone number</h3>
        <p>Your phone number is used for SMS and phone call job notifications. Without it, you'll only receive email notifications. Enter it in the format <code className="bg-gray-100 px-1 rounded text-xs">555-555-1234</code> or <code className="bg-gray-100 px-1 rounded text-xs">(555) 555-1234</code>.</p>

        <h3 className="font-semibold text-gray-800 mt-4">County</h3>
        <p>Setting your county helps schools in your area find your profile in the substitute directory. Choose the county where you're willing to work.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Resume</h3>
        <p>Upload a PDF resume to let schools know your background and experience. Click <strong>Upload Resume</strong> and select a PDF file. Your resume is visible to school administrators.</p>

        <h3 className="font-semibold text-gray-800 mt-4">Profile photo</h3>
        <Steps items={[
          'Click "Change photo" or tap the camera icon on your avatar.',
          'Select a photo from your device. SubHub automatically resizes it.',
          'Your photo saves immediately and appears in the sidebar.',
        ]} />
      </Section>

    </div>
  )
}
