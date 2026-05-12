import { NextResponse } from 'next/server'
import { db } from '@/db'
import { teacherTimeOff } from '@/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { reBlastNonDecliners } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Runs at 6:20am Pacific (13:20 UTC). Re-notifies subs who haven't declined
// for any position that is still unfilled 20 minutes after the morning blast.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const TZ = 'America/Los_Angeles'
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ })

  // Find today's positions that were blasted but still have no sub assigned
  const stillUnfilled = await db
    .select({ id: teacherTimeOff.id, organizationId: teacherTimeOff.organizationId })
    .from(teacherTimeOff)
    .where(and(
      eq(teacherTimeOff.startDate, today),
      eq(teacherTimeOff.approvalStatus, 'approved'),
      eq(teacherTimeOff.substituteRequired, true),
      eq(teacherTimeOff.subOutreachStatus, 'sent'),
      ne(teacherTimeOff.approvalStatus, 'denied'),
    ))

  const results = []
  for (const row of stillUnfilled) {
    try {
      const result = await reBlastNonDecliners(row.id)
      results.push({ id: row.id, orgId: row.organizationId, sent: result.sent, errors: result.errors })
    } catch (err) {
      results.push({ id: row.id, orgId: row.organizationId, error: String(err) })
    }
  }

  console.log(`[REBLAST] ${today}: re-blasted ${stillUnfilled.length} unfilled positions`)
  return NextResponse.json({ date: today, positions: stillUnfilled.length, results })
}
