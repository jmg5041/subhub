import { NextResponse } from 'next/server'
import { db } from '@/db'
import { teacherTimeOff } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { notifyAdminsUnfilled } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Runs at 6:30am Pacific. Scheduled at both 13:30 and 14:30 UTC to cover PDT and PST.
// Emails admin if any position is still unfilled after the 6am blast and 6:20am re-blast.
// Does NOT re-blast subs — the dedicated reblast cron at 6:20am handles that.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const TZ = 'America/Los_Angeles'
  const pacificHour = parseInt(
    new Date().toLocaleTimeString('en-US', { timeZone: TZ, hour: '2-digit', hour12: false }).split(':')[0]
  )
  if (pacificHour !== 6) {
    return NextResponse.json({ skipped: true, reason: `Pacific hour is ${pacificHour}, expected 6` })
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ })

  // Find today's absences that were blasted but nobody has accepted yet
  const unfilled = await db
    .select({ id: teacherTimeOff.id })
    .from(teacherTimeOff)
    .where(and(
      eq(teacherTimeOff.startDate, today),
      eq(teacherTimeOff.approvalStatus, 'approved'),
      eq(teacherTimeOff.substituteRequired, true),
      eq(teacherTimeOff.subOutreachStatus, 'sent'),
    ))

  const results = []
  for (const absence of unfilled) {
    try {
      await notifyAdminsUnfilled(absence.id)
      results.push({ absenceId: absence.id, adminAlerted: true })
    } catch (err) {
      results.push({ absenceId: absence.id, error: String(err) })
    }
  }

  console.log(`[UNFILLED ALERT] ${today}: alerted admin for ${results.length} unfilled absences`)
  return NextResponse.json({ date: today, processed: results.length, results })
}
