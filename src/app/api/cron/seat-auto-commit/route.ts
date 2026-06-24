/**
 * Daily seat check — runs once at 7am UTC (midnight PST / 3am EST).
 *
 * Two jobs in one pass:
 *   1. Commit expired windows: orgs whose 48h window closed — lock in the new seat count.
 *   2. Divergence check: orgs whose active teacher count no longer matches seatCount
 *      — open a new 48h window and send ONE email for the day's net change.
 *
 * Running once daily means an admin can add/remove teachers freely all day
 * and only ever gets a single notification capturing the net change.
 */

import { NextResponse } from 'next/server'
import { db } from '@/db'
import { organizations } from '@/db/schema'
import { and, isNotNull, lte, ne } from 'drizzle-orm'
import { commitSeatUpdate, checkAndTriggerSeatUpdate } from '@/lib/seat-management'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Step 1: commit any expired 48h windows ──────────────────────────────────
  const expired = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(
      isNotNull(organizations.pendingSeatCount),
      lte(organizations.pendingSeatUpdateAt, new Date())
    ))

  const commitResults = await Promise.allSettled(
    expired.map(org => commitSeatUpdate(org.id))
  )
  const committed = commitResults.filter(r => r.status === 'fulfilled').length
  const commitFailed = commitResults.filter(r => r.status === 'rejected').length

  // ── Step 2: check all active orgs for seat divergence ──────────────────────
  // Only orgs that: have a seatCount, completed onboarding, are not the platform org,
  // and don't already have a pending window (those were just committed or are still open).
  const activeOrgs = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(
      ne(organizations.slug, 'subhub-platform'),
      isNotNull(organizations.seatCount),
      isNotNull(organizations.onboardingCompletedAt)
    ))

  const checkResults = await Promise.allSettled(
    activeOrgs.map(org => checkAndTriggerSeatUpdate(org.id))
  )
  const checked = checkResults.filter(r => r.status === 'fulfilled').length
  const checkFailed = checkResults.filter(r => r.status === 'rejected').length

  console.log(`[SEAT DAILY] committed=${committed} commitFailed=${commitFailed} checked=${checked} checkFailed=${checkFailed}`)
  return NextResponse.json({ committed, commitFailed, checked, checkFailed })
}
