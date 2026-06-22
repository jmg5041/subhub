import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { campuses, organizations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getEffectiveOrgId } from '@/lib/impersonation'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = await getEffectiveOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const [org, orgCampuses] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(organizations.id, orgId), columns: { name: true, districtName: true } }),
    db.query.campuses.findMany({
      where: eq(campuses.organizationId, orgId),
      with: { schools: { columns: { id: true, name: true } } },
      orderBy: (c, { asc }) => [asc(c.createdAt)],
    }),
  ])

  return NextResponse.json({ name: org?.name ?? '', districtName: org?.districtName ?? null, campuses: orgCampuses })
}
