/**
 * Seat management — 48-hour window for seat count changes.
 *
 * When the active teacher count diverges from the org's purchased seatCount,
 * we give the admin 48 hours to review and confirm the change before it locks in.
 *
 * Flow:
 *   teacher added/removed → checkAndTriggerSeatUpdate(orgId)
 *     → if count ≠ seatCount: set pendingSeatCount + pendingSeatUpdateAt (now + 48h)
 *     → email admin + billing contact
 *   Admin clicks "Commit now" OR 48h expires (cron):
 *     → commitSeatUpdate(orgId)
 *     → updates seatCount, clears pending fields
 *     → updates Stripe quantity (no proration — takes effect next billing cycle)
 *     → emails admin + billing contact confirmation
 */

import { db } from '@/db'
import { organizations, users, employees, billingEvents, platformSettings } from '@/db/schema'
import { eq, and, countDistinct } from 'drizzle-orm'
import { sendSubEmail } from './notifications'
import { emailHeader } from './email-utils'
import { stripe } from './stripe'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

async function getActiveTeacherCount(orgId: string): Promise<number> {
  const [row] = await db
    .select({ value: countDistinct(employees.userId) })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .where(and(eq(users.organizationId, orgId), eq(users.status, 'active')))
  return Number(row?.value ?? 0)
}

async function getRecipients(org: typeof organizations.$inferSelect): Promise<string[]> {
  const admins = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.organizationId, org.id))
  const all = [
    ...admins.map(a => a.email),
    org.billingContactEmail,
  ].filter((e): e is string => !!e)
  return [...new Set(all)]
}

export async function checkAndTriggerSeatUpdate(orgId: string): Promise<void> {
  const [org, settings] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(organizations.id, orgId) }),
    db.query.platformSettings.findFirst(),
  ])
  if (!org || !org.seatCount) return // no billing seat count set yet

  const teacherCount = await getActiveTeacherCount(orgId)

  // Count returned to match seatCount — clear any pending window
  if (teacherCount === org.seatCount) {
    if (org.pendingSeatCount !== null) {
      await db.update(organizations)
        .set({ pendingSeatCount: null, pendingSeatUpdateAt: null })
        .where(eq(organizations.id, orgId))
    }
    return
  }

  // Already tracking this exact count — don't re-send the email
  if (teacherCount === org.pendingSeatCount) return

  const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000)
  await db.update(organizations)
    .set({ pendingSeatCount: teacherCount, pendingSeatUpdateAt: deadline })
    .where(eq(organizations.id, orgId))

  // Send alert email
  const logoUrl = settings?.logoUrl
  const pricePerSeat = (settings?.pricePerSeatCents ?? 800) / 100
  const newMonthly = (teacherCount * pricePerSeat).toFixed(2)
  const oldMonthly = (org.seatCount * pricePerSeat).toFixed(2)
  const deadlineStr = deadline.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const direction = teacherCount > org.seatCount ? 'increased' : 'decreased'

  const subject = `Seat count update for ${org.name} — action needed`
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      ${emailHeader(logoUrl)}
      <div style="padding:24px;">
        <h2 style="margin-top:0;color:#111;">Your teacher count has ${direction}</h2>
        <p style="color:#374151;">The number of active teachers at <strong>${org.name}</strong> has changed and no longer matches your current seat count.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;width:180px;">Current plan</td><td style="padding:8px 0;font-size:14px;">${org.seatCount} seats — $${oldMonthly}/month</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Active teachers</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${teacherCount} teachers — $${newMonthly}/month</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Auto-updates on</td><td style="padding:8px 0;font-size:14px;color:#dc2626;">${deadlineStr}</td></tr>
        </table>
        <p style="color:#374151;font-size:14px;">Your seat count will automatically update to <strong>${teacherCount} seats</strong> on ${deadlineStr} unless you adjust it first.</p>
        <div style="margin:24px 0;">
          <a href="${APP_URL}/billing" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">Review & Commit Now</a>
        </div>
        <p style="color:#6b7280;font-size:12px;">You can set a different seat count from your billing page if the auto-detected count isn't right.</p>
      </div>
    </div>`
  const text = `Your teacher count at ${org.name} has ${direction} to ${teacherCount} (currently paying for ${org.seatCount} seats).\n\nYour plan will auto-update to ${teacherCount} seats ($${newMonthly}/month) on ${deadlineStr}.\n\nReview and commit now: ${APP_URL}/billing`

  const recipients = await getRecipients(org)
  for (const to of recipients) {
    await sendSubEmail({ to, subject, html, text }).catch(() => {})
  }
}

export async function commitSeatUpdate(orgId: string, newCount?: number): Promise<void> {
  const [org, settings] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(organizations.id, orgId) }),
    db.query.platformSettings.findFirst(),
  ])
  if (!org) return

  const seatCount = newCount ?? org.pendingSeatCount ?? org.seatCount
  if (!seatCount) return

  await db.update(organizations)
    .set({ seatCount, pendingSeatCount: null, pendingSeatUpdateAt: null })
    .where(eq(organizations.id, orgId))

  // Update Stripe subscription quantity if on Stripe billing
  if (org.stripeSubscriptionId && org.paymentMethod === 'stripe') {
    try {
      const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId, {
        expand: ['items.data'],
      })
      const itemId = sub.items.data[0]?.id
      if (itemId) {
        await stripe.subscriptions.update(org.stripeSubscriptionId, {
          items: [{ id: itemId, quantity: seatCount }],
          proration_behavior: 'none', // no mid-cycle charge — takes effect next billing cycle
        })
      }
    } catch (err) {
      console.error('[SEAT COMMIT] Stripe update failed:', err)
    }
  }

  // Log billing event
  await db.insert(billingEvents).values({
    organizationId: orgId,
    type: 'status_change',
    note: `Seat count updated to ${seatCount}`,
    createdBy: null,
  })

  // Send confirmation email
  const logoUrl = settings?.logoUrl
  const pricePerSeat = (settings?.pricePerSeatCents ?? 800) / 100
  const newMonthly = (seatCount * pricePerSeat).toFixed(2)

  const subject = `SubHub plan updated — ${seatCount} seats`
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      ${emailHeader(logoUrl)}
      <div style="padding:24px;">
        <h2 style="margin-top:0;color:#111;">Plan updated</h2>
        <p style="color:#374151;">Your SubHub plan for <strong>${org.name}</strong> has been updated.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;width:160px;">New seat count</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${seatCount} seats</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">New monthly rate</td><td style="padding:8px 0;font-size:14px;">$${newMonthly}/month</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Effective</td><td style="padding:8px 0;font-size:14px;">Next billing cycle</td></tr>
        </table>
        <a href="${APP_URL}/billing" style="display:inline-block;background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">View Billing</a>
      </div>
    </div>`
  const text = `Your SubHub plan for ${org.name} has been updated to ${seatCount} seats ($${newMonthly}/month), effective next billing cycle.\n\nView billing: ${APP_URL}/billing`

  const recipients = await getRecipients(org)
  for (const to of recipients) {
    await sendSubEmail({ to, subject, html, text }).catch(() => {})
  }
}
