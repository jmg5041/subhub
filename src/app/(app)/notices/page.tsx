import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users, organizations, substitutes, subSchoolAssignments, schools, invitations } from '@/db/schema'
import { eq, and, notExists } from 'drizzle-orm'
import { getEffectiveOrgId } from '@/lib/impersonation'
import Link from 'next/link'
import { Bell, Mail, UserX, PhoneOff, ExternalLink } from 'lucide-react'

export default async function NoticesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const orgId = await getEffectiveOrgId(user.id)
  if (!orgId) redirect('/dashboard')

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { notifyBySms: true, cronEnabled: true },
  })

  // 0. Setup checklist (Steps 4-6)
  const [firstSchool, firstTeacher, firstSub, firstTeacherInvite, firstSubInvite] = await Promise.all([
    db.query.schools.findFirst({ where: eq(schools.organizationId, orgId) }),
    db.query.users.findFirst({ where: and(eq(users.organizationId, orgId), eq(users.role, 'teacher')) }),
    db.query.users.findFirst({ where: and(eq(users.organizationId, orgId), eq(users.role, 'substitute')) }),
    db.query.invitations.findFirst({ where: and(eq(invitations.organizationId, orgId), eq(invitations.role, 'teacher')) }),
    db.query.invitations.findFirst({ where: and(eq(invitations.organizationId, orgId), eq(invitations.role, 'substitute')) }),
  ])
  const setupChecklist = {
    schoolReady: !!firstSchool?.phone,
    hasTeachers: !!firstTeacher || !!firstTeacherInvite,
    hasSubs: !!firstSub || !!firstSubInvite,
  }
  const setupIncomplete = !setupChecklist.schoolReady || !setupChecklist.hasTeachers || !setupChecklist.hasSubs

  // 1. Bounced emails
  const bouncedUsers = await db.query.users.findMany({
    where: and(eq(users.organizationId, orgId), eq(users.emailBounced, true)),
    columns: { id: true, firstName: true, lastName: true, email: true, role: true, emailBouncedAt: true },
    orderBy: (u, { desc }) => [desc(u.emailBouncedAt)],
  })

  // 2. Subs with no school assignment
  const allSubs = await db
    .select({ userId: substitutes.userId, firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(substitutes)
    .innerJoin(users, eq(substitutes.userId, users.id))
    .where(
      and(
        eq(users.organizationId, orgId),
        notExists(
          db.select({ id: subSchoolAssignments.id })
            .from(subSchoolAssignments)
            .where(eq(subSchoolAssignments.substituteId, substitutes.id))
        )
      )
    )

  // 3. Subs with no phone (when SMS is enabled for org)
  const subsNoPhone = org?.notifyBySms
    ? await db.query.users.findMany({
        where: and(
          eq(users.organizationId, orgId),
          eq(users.role, 'substitute'),
        ),
        columns: { id: true, firstName: true, lastName: true, email: true, phone: true },
      }).then(rows => rows.filter(u => !u.phone))
    : []

  const notificationsPaused = org?.cronEnabled === false
  const totalCount = (setupIncomplete ? 1 : 0) + (notificationsPaused ? 1 : 0) + bouncedUsers.length + allSubs.length + subsNoPhone.length

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Bell className="h-8 w-8 text-gray-600" />
          {totalCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {totalCount > 9 ? '9+' : totalCount}
            </span>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notices</h1>
          <p className="text-gray-500">Items that need your attention.</p>
        </div>
      </div>

      {/* Welcome / finish onboarding — shown until all 3 setup steps are done */}
      {setupIncomplete && (
        <div className="rounded-lg border-2 border-fuchsia-400 bg-fuchsia-50 px-5 py-5 space-y-4">
          <div>
            <p className="font-bold text-fuchsia-900 uppercase tracking-wide">Welcome! Finish Setting Up SubHub</p>
            <p className="text-sm text-fuchsia-700 mt-1">
              You finished the onboarding wizard — great work! Complete these final steps to start managing absences and notifying substitutes.
            </p>
          </div>
          <div className="space-y-2">
            {[
              {
                step: 4,
                done: setupChecklist.schoolReady,
                label: 'Configure your school',
                description: 'Add a main office phone number to each school. The campus address is already set from onboarding.',
                href: '/admin/schools',
              },
              {
                step: 5,
                done: setupChecklist.hasTeachers,
                label: 'Invite or import teachers',
                description: 'Teachers need accounts to submit absence requests. Use Manage Users → Bulk import from CSV for fastest setup.',
                href: '/admin/users',
              },
              {
                step: 6,
                done: setupChecklist.hasSubs,
                label: 'Invite or import substitutes',
                description: 'Substitutes need accounts to receive job notifications. Import them via CSV or invite individually.',
                href: '/admin/users',
              },
            ].map(item => (
              <div key={item.step} className={`flex items-start gap-3 rounded-lg border px-4 py-3 bg-white ${item.done ? 'opacity-60' : ''}`}>
                <div className={`flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold mt-0.5 ${item.done ? 'bg-green-500 text-white' : 'bg-fuchsia-200 text-fuchsia-800'}`}>
                  {item.done ? '✓' : item.step}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${item.done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    Step {item.step}: {item.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                </div>
                {!item.done && (
                  <Link href={item.href} className="flex-shrink-0 text-xs font-medium text-fuchsia-700 hover:underline">
                    Go →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications paused — highest priority */}
      {notificationsPaused && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-5 py-4">
          <p className="font-semibold text-red-800">⚠ Substitute notifications are paused</p>
          <p className="text-sm text-red-700 mt-1">
            Your school is not sending any job alerts, re-blasts, or unfilled-position notifications to substitutes.
            This is usually caused by a billing issue. Contact <a href="mailto:info@substitutes.us" className="underline">info@substitutes.us</a> or visit your{' '}
            <a href="/billing" className="underline">Billing page</a> to restore service.
          </p>
        </div>
      )}

      {totalCount === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-16 text-center">
          <Bell className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-500">All clear — no notices right now.</p>
        </div>
      )}

      {/* Bounced emails */}
      {bouncedUsers.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-red-500" />
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
              Bounced emails ({bouncedUsers.length})
            </h2>
          </div>
          <p className="text-xs text-gray-500 ml-6">
            These email addresses failed to deliver. The person won&apos;t receive any notifications until the address is corrected.
          </p>
          <div className="rounded-lg border border-red-100 bg-white overflow-hidden">
            {bouncedUsers.map((u, i) => (
              <div key={u.id} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                  <p className="text-xs text-red-500">{u.email} · <span className="capitalize">{u.role}</span></p>
                </div>
                <Link href="/admin/users" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  Fix in Manage Users <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Subs with no school assignment */}
      {allSubs.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <UserX className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
              Substitutes with no school assigned ({allSubs.length})
            </h2>
          </div>
          <p className="text-xs text-gray-500 ml-6">
            These substitutes won&apos;t be called for any jobs until they&apos;re assigned to at least one school.
          </p>
          <div className="rounded-lg border border-amber-100 bg-white overflow-hidden">
            {allSubs.map((u, i) => (
              <div key={u.userId} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
                <Link href="/admin/subs/roster" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  Assign school <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Subs with no phone when SMS is on */}
      {subsNoPhone.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <PhoneOff className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
              Substitutes with no phone number ({subsNoPhone.length})
            </h2>
          </div>
          <p className="text-xs text-gray-500 ml-6">
            SMS notifications are enabled but these substitutes have no phone number on file — they&apos;ll only receive email notifications.
          </p>
          <div className="rounded-lg border border-amber-100 bg-white overflow-hidden">
            {subsNoPhone.map((u, i) => (
              <div key={u.id} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
                <Link href="/admin/users" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  Add phone <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
