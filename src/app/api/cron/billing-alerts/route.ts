import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { db } from '@/db'
import { organizations, users, employees, platformSettings } from '@/db/schema'
import { eq, and, countDistinct, ne } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Runs once daily at 10am UTC (3am Pacific). No DST issues since billing alerts
// don't need to fire at a specific local time — once per day is sufficient.

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = 'SubHub <no-reply@substitutes.us>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

async function sendEmail(to: string, subject: string, html: string, text: string) {
  if (!resend) { console.log(`[BILLING ALERT EMAIL] To: ${to} | ${subject}`); return }
  const { error } = await resend.emails.send({ from: FROM, to, subject, html, text })
  if (error) console.error(`[BILLING ALERT] Failed to send to ${to}:`, error)
}

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T12:00:00')
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await db.query.platformSettings.findFirst()
  const staffEmail = settings?.staffAlertEmail
  const pricePerSeat = (settings?.pricePerSeatCents ?? 800) / 100

  // Get all orgs still on trial with a paidThrough date
  const trialOrgs = await db.query.organizations.findMany({
    where: and(
      eq(organizations.subscriptionStatus, 'trial'),
      ne(organizations.slug, 'subhub-platform'),
    ),
  })

  const results: string[] = []

  for (const org of trialOrgs) {
    if (!org.paidThrough) continue

    const days = daysUntil(org.paidThrough)

    // Get admin email
    const admin = await db.query.users.findFirst({
      where: and(
        eq(users.organizationId, org.id),
        eq(users.role, 'admin'),
      ),
      columns: { email: true, firstName: true },
    })
    if (!admin?.email) continue

    const adminEmail = admin.email
    const adminName = admin.firstName ?? 'there'
    const billingUrl = `${APP_URL}/billing`
    const isInvoicePayer = org.paymentMethod === 'check'

    // Get teacher count for billing amount estimate
    const [{ value: teacherCount }] = await db
      .select({ value: countDistinct(employees.userId) })
      .from(employees)
      .innerJoin(users, eq(employees.userId, users.id))
      .where(eq(users.organizationId, org.id))
    const seats = org.seatCount ?? Math.max(Number(teacherCount), 1)
    const monthlyAmt = seats * pricePerSeat

    // ── 14-day warning ────────────────────────────────────────────────────────
    if (days === 14) {
      const subject = 'Your SubHub trial ends in 14 days'
      const text = `Hi ${adminName},\n\nYour SubHub free trial ends in 14 days on ${org.paidThrough}.\n\nBased on ${seats} seats in your plan, your monthly rate will be $${monthlyAmt}/month.\n\nSet up billing now to keep your substitute coverage running without interruption:\n${billingUrl}\n\n— The SubHub Team`
      const html = `<p>Hi ${adminName},</p><p>Your SubHub free trial ends in <strong>14 days</strong> on ${org.paidThrough}.</p><p>Based on <strong>${seats} seats</strong> in your plan, your monthly rate will be <strong>$${monthlyAmt}/month</strong>.</p><p><a href="${billingUrl}">Set up billing now</a> to keep your substitute coverage running without interruption.</p><p>— The SubHub Team</p>`
      await sendEmail(adminEmail, subject, html, text)
      results.push(`${org.name}: 14-day warning sent`)
    }

    // ── 3-day warning ─────────────────────────────────────────────────────────
    else if (days === 3) {
      const subject = 'Urgent: Your SubHub trial ends in 3 days'
      const text = `Hi ${adminName},\n\nYour SubHub free trial ends in 3 days on ${org.paidThrough}.\n\nAfter that date, substitute notifications will stop until billing is set up.\n\nSet up billing now:\n${billingUrl}\n\n— The SubHub Team`
      const html = `<p>Hi ${adminName},</p><p><strong>Your SubHub free trial ends in 3 days</strong> on ${org.paidThrough}.</p><p>After that date, substitute notifications will stop until billing is set up.</p><p><a href="${billingUrl}">Set up billing now →</a></p><p>— The SubHub Team</p>`
      await sendEmail(adminEmail, subject, html, text)
      results.push(`${org.name}: 3-day warning sent`)
    }

    // ── Trial expired (days = -1, i.e. the day after paidThrough) ────────────
    else if (days === -1) {
      // Email to school admin
      const adminSubject = 'Your SubHub trial has ended'
      if (isInvoicePayer) {
        const adminText = `Hi ${adminName},\n\nYour SubHub free trial ended on ${org.paidThrough}.\n\nTo continue using SubHub, please send payment of $${monthlyAmt}/month to info@substitutes.us and we will reactivate your account.\n\n— The SubHub Team`
        const adminHtml = `<p>Hi ${adminName},</p><p>Your SubHub free trial ended on ${org.paidThrough}.</p><p>To continue using SubHub, please send payment of <strong>$${monthlyAmt}/month</strong> to <a href="mailto:info@substitutes.us">info@substitutes.us</a> and we will reactivate your account.</p><p>— The SubHub Team</p>`
        await sendEmail(adminEmail, adminSubject, adminHtml, adminText)
      } else {
        // Credit card payer — Stripe will handle charging, just let them know
        const adminText = `Hi ${adminName},\n\nYour SubHub free trial ended on ${org.paidThrough}. Your card on file will be charged $${monthlyAmt}/month going forward.\n\nThank you for using SubHub!\n\n— The SubHub Team`
        const adminHtml = `<p>Hi ${adminName},</p><p>Your SubHub free trial ended on ${org.paidThrough}. Your card on file will be charged <strong>$${monthlyAmt}/month</strong> going forward.</p><p>Thank you for using SubHub!</p><p>— The SubHub Team</p>`
        await sendEmail(adminEmail, adminSubject, adminHtml, adminText)
      }

      // Staff alert for invoice payers only
      if (isInvoicePayer && staffEmail) {
        const staffText = `ACTION NEEDED: ${org.name}'s trial ended on ${org.paidThrough}.\n\nPayment method: Invoice/Check\nSeats: ${seats}\nMonthly rate: $${monthlyAmt}/month\n\nFollow up and turn off their notifications in the platform if unpaid:\n${APP_URL}/platform/${org.id}\n\n(A reminder will be sent in 7 days if still unpaid.)`
        const staffHtml = `<p><strong>ACTION NEEDED:</strong> ${org.name}'s trial ended on ${org.paidThrough}.</p><ul><li>Payment method: Invoice/Check</li><li>Seats: ${seats}</li><li>Monthly rate: $${monthlyAmt}/month</li></ul><p><a href="${APP_URL}/platform/${org.id}">Review in platform →</a></p><p>Turn off their notifications if unpaid. A reminder will arrive in 7 days if still unpaid.</p>`
        await sendEmail(staffEmail, `ACTION NEEDED: ${org.name} trial ended`, staffHtml, staffText)
        results.push(`${org.name}: expiry staff alert sent`)
      }

      results.push(`${org.name}: expiry notice sent`)
    }

    // ── 7-day overdue reminder (invoice payers only) ──────────────────────────
    else if (days === -8 && isInvoicePayer && staffEmail) {
      const text = `REMINDER: ${org.name} is now 7 days past their trial end date (${org.paidThrough}) and is still on trial status.\n\nSeats: ${seats} | Monthly rate: $${monthlyAmt}/month\n\nIf payment has not been received, consider turning off their notifications:\n${APP_URL}/platform/${org.id}`
      const html = `<p><strong>REMINDER:</strong> ${org.name} is 7 days past their trial end date (${org.paidThrough}) and still has not been marked as paid.</p><ul><li>Seats: ${seats}</li><li>Monthly rate: $${monthlyAmt}/month</li></ul><p><a href="${APP_URL}/platform/${org.id}">Review in platform →</a></p><p>If payment has not been received, turn off their notifications from the kill switch on this page.</p>`
      await sendEmail(staffEmail, `REMINDER: ${org.name} — 7 days overdue`, html, text)
      results.push(`${org.name}: 7-day overdue staff reminder sent`)
    }
  }

  // ── Monthly reminders for past_due orgs (fires on the 1st of each month) ────
  const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'UTC' }) // YYYY-MM-DD
  const isFirstOfMonth = todayDate.endsWith('-01')

  if (isFirstOfMonth) {
    const pastDueOrgs = await db.query.organizations.findMany({
      where: and(
        eq(organizations.subscriptionStatus, 'past_due'),
        ne(organizations.slug, 'subhub-platform'),
      ),
    })

    for (const org of pastDueOrgs) {
      const admin = await db.query.users.findFirst({
        where: and(eq(users.organizationId, org.id), eq(users.role, 'admin')),
        columns: { email: true, firstName: true },
      })
      if (!admin?.email) continue

      const [{ value: teacherCount }] = await db
        .select({ value: countDistinct(employees.userId) })
        .from(employees)
        .innerJoin(users, eq(employees.userId, users.id))
        .where(eq(users.organizationId, org.id))
      const seats = org.seatCount ?? Math.max(Number(teacherCount), 1)
      const monthlyAmt = seats * pricePerSeat
      const adminName = admin.firstName ?? 'there'
      const isInvoicePayer = org.paymentMethod === 'check'

      if (isInvoicePayer) {
        // Monthly invoice email for check payers
        const subject = `SubHub Invoice — $${monthlyAmt.toFixed(2)} due for ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
        const text = `Hi ${adminName},\n\nYour SubHub invoice for ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} is due.\n\nAmount: $${monthlyAmt.toFixed(2)}/month (${seats} seats × $${pricePerSeat.toFixed(2)}/seat)\n\nPlease send payment to info@substitutes.us or mail a check to our address on file.\n\nThank you,\nThe SubHub Team`
        const html = `<p>Hi ${adminName},</p><p>Your SubHub invoice for <strong>${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong> is due.</p><ul><li>Amount: <strong>$${monthlyAmt.toFixed(2)}/month</strong></li><li>${seats} seats × $${pricePerSeat.toFixed(2)}/seat</li></ul><p>Please send payment to <a href="mailto:info@substitutes.us">info@substitutes.us</a> or mail a check to our address on file.</p><p>— The SubHub Team</p>`
        await sendEmail(admin.email, subject, html, text)
        if (staffEmail) {
          await sendEmail(staffEmail, `Invoice sent: ${org.name} ($${monthlyAmt.toFixed(2)})`, html, text)
        }
        results.push(`${org.name}: monthly invoice sent`)
      } else {
        // Past-due credit card: prompt to update card via Stripe portal
        const portalUrl = `${APP_URL}/billing`
        const subject = 'Action required: Update your SubHub payment method'
        const text = `Hi ${adminName},\n\nYour SubHub payment of $${monthlyAmt.toFixed(2)}/month didn't go through. Please update your payment method to keep your account active.\n\nUpdate now: ${portalUrl}\n\n— The SubHub Team`
        const html = `<p>Hi ${adminName},</p><p>Your SubHub payment of <strong>$${monthlyAmt.toFixed(2)}/month</strong> didn't go through. Please update your payment method to keep your account active.</p><p><a href="${portalUrl}">Update payment method →</a></p><p>— The SubHub Team</p>`
        await sendEmail(admin.email, subject, html, text)
        results.push(`${org.name}: past_due card reminder sent`)
      }
    }
  }

  console.log(`[BILLING ALERTS] Processed ${trialOrgs.length} trial orgs. Actions: ${results.length}`)
  return NextResponse.json({ orgs: trialOrgs.length, actions: results })
}
