import { NextResponse } from 'next/server'
import { db } from '@/db'
import { teacherTimeOff } from '@/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { notifyAllSubs } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Tomorrow's date in Pacific time — the PM blast runs at 6am UTC (11pm PDT / 10pm PST).
  // At that hour, new Date() is already the next UTC calendar day, so UTC date arithmetic
  // gives a date that is one day too far ahead from Pacific perspective. We must derive
  // "today" in Pacific time first, then add one day.
  const TZ = 'America/Los_Angeles'
  const todayPacific = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const [py, pm, pd] = todayPacific.split('-').map(Number)
  const tomorrowStr = new Date(Date.UTC(py, pm - 1, pd + 1)).toISOString().split('T')[0]

  const pending = await db
    .select({ id: teacherTimeOff.id, organizationId: teacherTimeOff.organizationId })
    .from(teacherTimeOff)
    .where(and(
      eq(teacherTimeOff.startDate, tomorrowStr),
      eq(teacherTimeOff.approvalStatus, 'approved'),
      eq(teacherTimeOff.substituteRequired, true),
      eq(teacherTimeOff.subOutreachStatus, 'not_started'),
      ne(teacherTimeOff.approvalStatus, 'denied'),
    ))

  // Group by org so each org gets one bundled blast
  const byOrg = new Map<string, string[]>()
  for (const a of pending) {
    const ids = byOrg.get(a.organizationId) ?? []
    ids.push(a.id)
    byOrg.set(a.organizationId, ids)
  }

  const results = []
  for (const [orgId, ids] of byOrg) {
    try {
      const result = await notifyAllSubs(ids)
      results.push({ orgId, positions: ids.length, sent: result.sent, errors: result.errors })
    } catch (err) {
      results.push({ orgId, positions: ids.length, error: String(err) })
    }
  }

  console.log(`[EVENING BLAST] for ${tomorrowStr}: ${pending.length} positions across ${byOrg.size} orgs`)
  return NextResponse.json({ date: tomorrowStr, orgs: byOrg.size, positions: pending.length, results })
}
