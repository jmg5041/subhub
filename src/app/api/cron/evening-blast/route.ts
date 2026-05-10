import { NextResponse } from 'next/server'
import { db } from '@/db'
import { teacherTimeOff } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { notifyAllSubs } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find tomorrow's date — the PM blast notifies subs the night before
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const pending = await db
    .select({ id: teacherTimeOff.id })
    .from(teacherTimeOff)
    .where(and(
      eq(teacherTimeOff.startDate, tomorrowStr),
      eq(teacherTimeOff.approvalStatus, 'approved'),
      eq(teacherTimeOff.substituteRequired, true),
      eq(teacherTimeOff.subOutreachStatus, 'not_started'),
    ))

  const results = []
  for (const absence of pending) {
    try {
      const result = await notifyAllSubs(absence.id)
      results.push({ absenceId: absence.id, sent: result.sent, errors: result.errors })
    } catch (err) {
      results.push({ absenceId: absence.id, error: String(err) })
    }
  }

  console.log(`[EVENING BLAST] for ${tomorrowStr}: processed ${results.length} absences`)
  return NextResponse.json({ date: tomorrowStr, processed: results.length, results })
}
