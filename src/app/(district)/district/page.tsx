import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users, organizations, schools, employees, teacherTimeOff } from '@/db/schema'
import { eq, and, isNull, count, countDistinct, sql } from 'drizzle-orm'

export default async function DistrictPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { organizationId: true, role: true },
  })
  if (!profile || profile.role !== 'district') redirect('/auth/login')

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, profile.organizationId),
    columns: { name: true, districtName: true, timezone: true },
  })

  const TZ = org?.timezone ?? 'America/Los_Angeles'
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ })

  // All schools in org
  const allSchools = await db.query.schools.findMany({
    where: eq(schools.organizationId, profile.organizationId),
    columns: { id: true, name: true, campus: true },
    orderBy: (s, { asc }) => [asc(s.campus), asc(s.name)],
  })

  // Teacher counts per school
  const teacherCounts = await db
    .select({ schoolId: employees.schoolId, count: count() })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .where(eq(users.organizationId, profile.organizationId))
    .groupBy(employees.schoolId)

  // Today's absence counts per school
  const todayAbsences = await db
    .select({ schoolId: teacherTimeOff.schoolId, count: count() })
    .from(teacherTimeOff)
    .where(and(
      eq(teacherTimeOff.organizationId, profile.organizationId),
      eq(teacherTimeOff.approvalStatus, 'approved'),
      isNull(teacherTimeOff.completedAt),
      sql`${teacherTimeOff.startDate} <= ${today}`,
      sql`COALESCE(${teacherTimeOff.endDate}, ${teacherTimeOff.startDate}) >= ${today}`,
    ))
    .groupBy(teacherTimeOff.schoolId)

  // Unfilled absence counts per school
  const unfilledAbsences = await db
    .select({ schoolId: teacherTimeOff.schoolId, count: count() })
    .from(teacherTimeOff)
    .where(and(
      eq(teacherTimeOff.organizationId, profile.organizationId),
      eq(teacherTimeOff.approvalStatus, 'approved'),
      eq(teacherTimeOff.substituteRequired, true),
      isNull(teacherTimeOff.completedAt),
      sql`COALESCE(${teacherTimeOff.endDate}, ${teacherTimeOff.startDate}) >= ${today}`,
      sql`${teacherTimeOff.subOutreachStatus} != 'filled'`,
    ))
    .groupBy(teacherTimeOff.schoolId)

  const teacherMap = new Map(teacherCounts.map(r => [r.schoolId, r.count]))
  const todayMap   = new Map(todayAbsences.map(r => [r.schoolId, r.count]))
  const unfilledMap = new Map(unfilledAbsences.map(r => [r.schoolId, r.count]))

  // Group schools by campus
  const campusMap = new Map<string, typeof allSchools>()
  for (const school of allSchools) {
    const key = school.campus || '(No campus set)'
    if (!campusMap.has(key)) campusMap.set(key, [])
    campusMap.get(key)!.push(school)
  }

  const districtName = org?.districtName || org?.name || 'District'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{districtName}</h1>
        <p className="text-gray-500 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ })}
        </p>
      </div>

      {campusMap.size === 0 && (
        <p className="text-gray-400 text-sm">No schools configured yet.</p>
      )}

      {Array.from(campusMap.entries()).map(([campus, campusSchools]) => (
        <div key={campus}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            {campus}
          </h2>
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 text-left">School</th>
                  <th className="px-5 py-3 text-center">Teachers</th>
                  <th className="px-5 py-3 text-center">Absences today</th>
                  <th className="px-5 py-3 text-center">Unfilled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campusSchools.map(school => {
                  const unfilled = Number(unfilledMap.get(school.id) ?? 0)
                  return (
                    <tr key={school.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{school.name}</td>
                      <td className="px-5 py-3 text-center text-gray-600">{teacherMap.get(school.id) ?? 0}</td>
                      <td className="px-5 py-3 text-center text-gray-600">{todayMap.get(school.id) ?? 0}</td>
                      <td className="px-5 py-3 text-center">
                        {unfilled > 0
                          ? <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">{unfilled} unfilled</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
