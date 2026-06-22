import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { db } from '@/db'
import { users, organizations, platformSettings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

// Verifies the Svix signature Resend sends with every webhook.
// secret format from Resend dashboard: "whsec_<base64>"
function verifySignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return false

  const svixId        = headers.get('svix-id') ?? ''
  const svixTimestamp = headers.get('svix-timestamp') ?? ''
  const svixSignature = headers.get('svix-signature') ?? ''
  if (!svixId || !svixTimestamp || !svixSignature) return false

  // Reject timestamps more than 5 minutes old
  const ts = parseInt(svixTimestamp, 10)
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false

  const secretBytes  = Buffer.from(secret.replace('whsec_', ''), 'base64')
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`
  const mac = createHmac('sha256', secretBytes).update(signedContent).digest('base64')

  return svixSignature.split(' ').some(sig => {
    const sigValue = sig.split(',')[1]
    if (!sigValue) return false
    try {
      return timingSafeEqual(Buffer.from(sigValue), Buffer.from(mac))
    } catch {
      return false
    }
  })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verifySignature(rawBody, req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const event = JSON.parse(rawBody) as {
    type: string
    data: { to: string[]; email_id: string }
  }

  // Only handle hard bounces and spam complaints
  if (event.type !== 'email.bounced' && event.type !== 'email.complained') {
    return NextResponse.json({ ok: true })
  }

  const toEmail = event.data.to?.[0]
  if (!toEmail) return NextResponse.json({ ok: true })

  // Find the user by email
  const user = await db.query.users.findFirst({
    where: eq(users.email, toEmail),
    columns: { id: true, firstName: true, lastName: true, email: true, organizationId: true },
  })
  if (!user) return NextResponse.json({ ok: true })

  // Flag the user
  await db.update(users)
    .set({ emailBounced: true, emailBouncedAt: new Date() })
    .where(eq(users.id, user.id))

  // Find the org admin to notify
  const [admin, settings] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.organizationId, user.organizationId),
      columns: { email: true, firstName: true },
      // pick admin or principal
    }),
    db.query.platformSettings.findFirst(),
  ])

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, user.organizationId),
    columns: { name: true },
  })

  const notifyEmails = [admin?.email, settings?.staffAlertEmail].filter(Boolean) as string[]
  const eventLabel = event.type === 'email.complained' ? 'marked as spam' : 'bounced'
  const manageUrl = `${APP_URL}/admin/users`

  if (resend && notifyEmails.length > 0) {
    const subject = `Email delivery failed: ${user.firstName} ${user.lastName} at ${org?.name}`
    const text = [
      `An email to ${user.firstName} ${user.lastName} (${user.email}) ${eventLabel}.`,
      ``,
      `This means they will not receive job notifications or any other emails from SubHub until their email address is corrected.`,
      ``,
      `Fix it here: ${manageUrl}`,
      ``,
      `Find them in Manage Users, click Edit, and update their email address.`,
    ].join('\n')
    const html = `
      <p>An email to <strong>${user.firstName} ${user.lastName}</strong> (${user.email}) <strong>${eventLabel}</strong>.</p>
      <p>They will not receive job notifications or any other emails from SubHub until their email address is corrected.</p>
      <p><a href="${manageUrl}">Fix it in Manage Users →</a></p>
      <p style="color:#666;font-size:12px;">Find them in Manage Users, click Edit, and update their email address.</p>
    `
    await resend.emails.send({
      from: 'SubHub <no-reply@substitutes.us>',
      to: notifyEmails,
      subject,
      text,
      html,
    })
  }

  return NextResponse.json({ ok: true })
}
