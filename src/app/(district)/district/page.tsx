import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users, organizations, schools, employees, teacherTimeOff } from '@/db/schema'
import { eq, and, isNull, count, sql } from 'drizzle-orm'

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

  // 30 days ago in org timezone
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString('en-CA', { timeZone: TZ })

  // All schools in org with their campus
  const allSchools = await db.query.schools.findMany({
    where: eq(schools.organizationId, profile.organizationId),
    columns: { id: true, name: true, campusId: true },
    with: { campus: { columns: { id: true, address: true, city: true } } },
    orderBy: (s, { asc }) => [asc(s.name)],
  })

  const [
    teacherCounts,
    todayAbsences,
    unfilledAbsences,
    monthAbsences,
    monthSubRequired,
    monthFilled,
  ] = await Promise.all([
    // Teacher counts per school
    db.select({ schoolId: employees.schoolId, count: count() })
      .from(employees)
      .innerJoin(users, eq(employees.userId, users.id))
      .where(eq(users.organizationId, profile.organizationId))
      .groupBy(employees.schoolId),

    // Today's absence counts per school
    db.select({ schoolId: teacherTimeOff.schoolId, count: count() })
      .from(teacherTimeOff)
      .where(and(
        eq(teacherTimeOff.organizationId, profile.organizationId),
        eq(teacherTimeOff.approvalStatus, 'approved'),
        isNull(teacherTimeOff.completedAt),
        sql`${teacherTimeOff.startDate} <= ${today}`,
        sql`COALESCE(${teacherTimeOff.endDate}, ${teacherTimeOff.startDate}) >= ${today}`,
      ))
      .groupBy(teacherTimeOff.schoolId),

    // Unfilled absence counts per school (today)
    db.select({ schoolId: teacherTimeOff.schoolId, count: count() })
      .from(teacherTimeOff)
      .where(and(
        eq(teacherTimeOff.organizationId, profile.organizationId),
        eq(teacherTimeOff.approvalStatus, 'approved'),
        eq(teacherTimeOff.substituteRequired, true),
        isNull(teacherTimeOff.completedAt),
        sql`COALESCE(${teacherTimeOff.endDate}, ${teacherTimeOff.startDate}) >= ${today}`,
        sql`${teacherTimeOff.subOutreachStatus} != 'filled'`,
      ))
      .groupBy(teacherTimeOff.schoolId),

    // 30-day total absences per school
    db.select({ schoolId: teacherTimeOff.schoolId, count: count() })
      .from(teacherTimeOff)
      .where(and(
        eq(teacherTimeOff.organizationId, profile.organizationId),
        eq(teacherTimeOff.approvalStatus, 'approved'),
        sql`${teacherTimeOff.startDate} >= ${thirtyDaysAgoStr}`,
      ))
      .groupBy(teacherTimeOff.schoolId),

    // 30-day absences requiring a sub per school
    db.select({ schoolId: teacherTimeOff.schoolId, count: count() })
      .from(teacherTimeOff)
      .where(and(
        eq(teacherTimeOff.organizationId, profile.organizationId),
        eq(teacherTimeOff.approvalStatus, 'approved'),
        eq(teacherTimeOff.substituteRequired, true),
        sql`${teacherTimeOff.startDate} >= ${thirtyDaysAgoStr}`,
      ))
      .groupBy(teacherTimeOff.schoolId),

    // 30-day filled absences per school
    db.select({ schoolId: teacherTimeOff.schoolId, count: count() })
      .from(teacherTimeOff)
      .where(and(
        eq(teacherTimeOff.organizationId, profile.organizationId),
        eq(teacherTimeOff.approvalStatus, 'approved'),
        eq(teacherTimeOff.substituteRequired, true),
        sql`${teacherTimeOff.subOutreachStatus} = 'filled'`,
        sql`${teacherTimeOff.startDate} >= ${thirtyDaysAgoStr}`,
      ))
      .groupBy(teacherTimeOff.schoolId),
  ])

  const teacherMap     = new Map(teacherCounts.map(r => [r.schoolId, Number(r.count)]))
  const todayMap       = new Map(todayAbsences.map(r => [r.schoolId, Number(r.count)]))
  const unfilledMap    = new Map(unfilledAbsences.map(r => [r.schoolId, Number(r.count)]))
  const monthMap       = new Map(monthAbsences.map(r => [r.schoolId, Number(r.count)]))
  const monthReqMap    = new Map(monthSubRequired.map(r => [r.schoolId, Number(r.count)]))
  const monthFilledMap = new Map(monthFilled.map(r => [r.schoolId, Number(r.count)]))

  // Org-wide today totals for summary cards
  const totalAbsencesToday = allSchools.reduce((sum, s) => sum + (todayMap.get(s.id) ?? 0), 0)
  const totalUnfilledToday = allSchools.reduce((sum, s) => sum + (unfilledMap.get(s.id) ?? 0), 0)
  const totalReq30         = allSchools.reduce((sum, s) => sum + (monthReqMap.get(s.id) ?? 0), 0)
  const totalFilled30      = allSchools.reduce((sum, s) => sum + (monthFilledMap.get(s.id) ?? 0), 0)
  const fillRate30         = totalReq30 > 0 ? Math.round((totalFilled30 / totalReq30) * 100) : null

  // Group schools by campus
  const campusMap = new Map<string, { label: string; schools: typeof allSchools }>()
  for (const school of allSchools) {
    const key = school.campusId ?? 'none'
    const label = school.campus
      ? [school.campus.address, school.campus.city].filter(Boolean).join(', ')
      : '(No campus set)'
    if (!campusMap.has(key)) campusMap.set(key, { label, schools: [] })
    campusMap.get(key)!.schools.push(school)
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

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Absences today</p>
          <p className="text-3xl font-bold text-gray-900">{totalAbsencesToday}</p>
          {totalUnfilledToday > 0 && (
            <p className="text-sm text-orange-600 mt-1">{totalUnfilledToday} unfilled</p>
          )}
          {totalUnfilledToday === 0 && totalAbsencesToday > 0 && (
            <p className="text-sm text-green-600 mt-1">All filled</p>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Fill rate (30 days)</p>
          {fillRate30 !== null ? (
            <>
              <p className={`text-3xl font-bold ${fillRate30 >= 90 ? 'text-green-600' : fillRate30 >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                {fillRate30}%
              </p>
              <p className="text-sm text-gray-400 mt-1">{totalFilled30} of {totalReq30} positions filled</p>
            </>
          ) : (
            <p className="text-2xl font-bold text-gray-300">—</p>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Absences (30 days)</p>
          <p className="text-3xl font-bold text-gray-900">
            {allSchools.reduce((sum, s) => sum + (monthMap.get(s.id) ?? 0), 0)}
          </p>
          <p className="text-sm text-gray-400 mt-1">across {allSchools.length} school{allSchools.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {campusMap.size === 0 && (
        <p className="text-gray-400 text-sm">No schools configured yet.</p>
      )}

      {Array.from(campusMap.entries()).map(([, { label, schools: campusSchools }]) => (
        <div key={label}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            {label}
          </h2>
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 text-left">School</th>
                  <th className="px-5 py-3 text-center">Teachers</th>
                  <th className="px-5 py-3 text-center">Absences today</th>
                  <th className="px-5 py-3 text-center">Unfilled</th>
                  <th className="px-5 py-3 text-center">30-day absences</th>
                  <th className="px-5 py-3 text-center">Fill rate (30d)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campusSchools.map(school => {
                  const unfilled   = unfilledMap.get(school.id) ?? 0
                  const req30      = monthReqMap.get(school.id) ?? 0
                  const filled30   = monthFilledMap.get(school.id) ?? 0
                  const rate       = req30 > 0 ? Math.round((filled30 / req30) * 100) : null
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
                      <td className="px-5 py-3 text-center text-gray-600">{monthMap.get(school.id) ?? 0}</td>
                      <td className="px-5 py-3 text-center">
                        {rate !== null ? (
                          <span className={`text-sm font-medium ${rate >= 90 ? 'text-green-600' : rate >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                            {rate}%
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
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
