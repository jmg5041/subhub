import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, campuses, schools } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getEffectiveOrgId } from '@/lib/impersonation'

async function getOrgId(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return getEffectiveOrgId(user.id)
}

export async function GET(req: NextRequest) {
  const orgId = await getOrgId(req)
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgCampuses = await db.query.campuses.findMany({
    where: eq(campuses.organizationId, orgId),
    with: { schools: { columns: { id: true, name: true } } },
    orderBy: (c, { asc }) => [asc(c.createdAt)],
  })

  return NextResponse.json(orgCampuses)
}

export async function POST(req: NextRequest) {
  const orgId = await getOrgId(req)
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { address, city, state, zip, phone } = await req.json()

  const [campus] = await db.insert(campuses)
    .values({ organizationId: orgId, address: address || null, city: city || null, state: state || 'CA', zip: zip || null, phone: phone || null })
    .returning()

  return NextResponse.json({ campus })
}

export async function PATCH(req: NextRequest) {
  const orgId = await getOrgId(req)
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, address, city, state, zip, phone } = body

  // Verify campus belongs to this org
  const campus = await db.query.campuses.findFirst({ where: eq(campuses.id, id) })
  if (!campus || campus.organizationId !== orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await db.update(campuses)
    .set({
      address: address || null,
      city: city || null,
      state: state || 'CA',
      zip: zip || null,
      phone: phone || null,
      updatedAt: new Date(),
    })
    .where(eq(campuses.id, id))

  return NextResponse.json({ ok: true })
}
