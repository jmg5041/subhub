/**
 * Dispatcher — runs every 5 minutes via Vercel cron.
 *
 * This is a lightweight orchestrator. It does NO blast work itself.
 * It only asks: "which orgs need a blast right now?" and hands each one
 * off to QStash as an independent job. QStash delivers to the per-org
 * blast endpoints and retries automatically on failure.
 *
 * At 1000 schools this function completes in under a second. Each school's
 * blast runs in its own isolated invocation with its own retry budget.
 */

import { NextResponse } from 'next/server'
import { db } from '@/db'
import { organizations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { qstashClient } from '@/lib/qstash'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

// Each entry: [localHour, localMinute, blastType, endpoint]
const BLAST_WINDOWS = [
  [21, 0,  'evening',        '/api/blast/evening'],
  [6,  0,  'morning',        '/api/blast/morning'],
  [6,  20, 'reblast',        '/api/blast/reblast'],
  [6,  30, 'unfilled-alert', '/api/blast/unfilled-alert'],
  [17, 30, 'complete',       '/api/blast/complete'],
] as const

// Returns true if the current local time falls within a 5-minute window
// starting at [targetHour:targetMin]. Since the dispatcher runs every 5 min,
// each window is hit exactly once per day per org.
function isInWindow(localHour: number, localMin: number, targetHour: number, targetMin: number) {
  const now = localHour * 60 + localMin
  const target = targetHour * 60 + targetMin
  return now >= target && now < target + 5
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgs = await db
    .select({ id: organizations.id, timezone: organizations.timezone })
    .from(organizations)
    .where(eq(organizations.cronEnabled, true))

  const published: { orgId: string; type: string }[] = []

  await Promise.all(
    orgs.map(async (org) => {
      const tz = org.timezone ?? 'America/Los_Angeles'
      const now = new Date()
      const localHour = parseInt(
        now.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', hour12: false })
      )
      const localMin = now.getMinutes()
      const localDate = now.toLocaleDateString('en-CA', { timeZone: tz })

      for (const [targetHour, targetMin, blastType, endpoint] of BLAST_WINDOWS) {
        if (!isInWindow(localHour, localMin, targetHour, targetMin)) continue

        // Deduplication key: one blast per org per type per day
        // QStash will silently drop duplicates within 24h — prevents double-blasting
        // if the dispatcher fires twice in the same 5-minute window.
        await qstashClient.publishJSON({
          url: `${APP_URL}${endpoint}`,
          body: { orgId: org.id },
          headers: {
            'Upstash-Deduplication-Id': `${org.id}-${blastType}-${localDate}`,
          },
          retries: 3,
        })

        published.push({ orgId: org.id, type: blastType })
      }
    })
  )

  console.log(`[DISPATCHER] Published ${published.length} blast jobs`)
  return NextResponse.json({ published: published.length, jobs: published })
}
