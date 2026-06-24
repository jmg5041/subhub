/**
 * Seat auto-commit cron — runs daily at 8am UTC.
 * Finds any orgs whose 48h seat update window has expired and commits the change.
 */

import { NextResponse } from 'next/server'
import { db } from '@/db'
import { organizations } from '@/db/schema'
import { and, isNotNull, lte } from 'drizzle-orm'
import { commitSeatUpdate } from '@/lib/seat-management'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const expired = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(
      isNotNull(organizations.pendingSeatCount),
      lte(organizations.pendingSeatUpdateAt, new Date())
    ))

  const results = await Promise.allSettled(
    expired.map(org => commitSeatUpdate(org.id))
  )

  const committed = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  console.log(`[SEAT AUTO-COMMIT] committed=${committed} failed=${failed}`)
  return NextResponse.json({ committed, failed })
}
