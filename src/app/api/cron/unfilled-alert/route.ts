import { NextResponse } from 'next/server'
import { db } from '@/db'
import { teacherTimeOff } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { notifyAdminsUnfilled, reBlastNonDecliners } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]

  // Find today's absences that were blasted but nobody has accepted yet
  const unfilled = await db
    .select({ id: teacherTimeOff.id })
    .from(teacherTimeOff)
    .where(and(
      eq(teacherTimeOff.startDate, today),
      eq(teacherTimeOff.approvalStatus, 'approved'),
      eq(teacherTimeOff.substituteRequired, true),
      eq(teacherTimeOff.subOutreachStatus, 'sent'),  // was blasted, but not filled
    ))

  const results = []
  for (const absence of unfilled) {
    try {
      // Alert admins that nobody has picked this up yet
      await notifyAdminsUnfilled(absence.id)

      // Re-blast to subs who haven't explicitly declined
      const reBlast = await reBlastNonDecliners(absence.id)
      results.push({ absenceId: absence.id, adminAlerted: true, reBlastSent: reBlast.sent })
    } catch (err) {
      results.push({ absenceId: absence.id, error: String(err) })
    }
  }

  console.log(`[UNFILLED ALERT] ${today}: processed ${results.length} unfilled absences`)
  return NextResponse.json({ date: today, processed: results.length, results })
}
