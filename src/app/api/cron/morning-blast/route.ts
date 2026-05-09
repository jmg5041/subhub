import { NextResponse } from 'next/server'
import { db } from '@/db'
import { teacherTimeOff } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { notifyAllSubs } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // Vercel sends Authorization: Bearer {CRON_SECRET} for cron invocations
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Today's date in YYYY-MM-DD (cron runs at 6am Pacific = 14:00 UTC)
  const today = new Date().toISOString().split('T')[0]

  // Find all today's absences that are approved, need a sub, and haven't been blasted
  const pending = await db
    .select({ id: teacherTimeOff.id })
    .from(teacherTimeOff)
    .where(and(
      eq(teacherTimeOff.startDate, today),
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

  console.log(`[MORNING BLAST] ${today}: processed ${results.length} absences`)
  return NextResponse.json({ date: today, processed: results.length, results })
}
