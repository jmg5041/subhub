'use server'

import { db } from '@/db'
import { users, organizations, billingEvents } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect, notFound } from 'next/navigation'

export async function getPlatformContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { id: true, isPlatformAdmin: true },
  })
  if (!profile?.isPlatformAdmin) throw new Error('Not authorized')

  return { adminUserId: profile.id }
}

export async function recordCheckPayment(formData: FormData) {
  const { adminUserId } = await getPlatformContext()

  const orgId       = formData.get('orgId') as string
  const amountStr   = formData.get('amount') as string
  const paidThrough = formData.get('paidThrough') as string
  const note        = (formData.get('note') as string) || null

  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
  if (!org) notFound()

  const amountCents = amountStr ? Math.round(parseFloat(amountStr) * 100) : null

  await Promise.all([
    db.update(organizations)
      .set({
        subscriptionStatus: 'active',
        paymentMethod: 'check',
        paidThrough,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId)),

    db.insert(billingEvents).values({
      organizationId: orgId,
      type: 'check_payment',
      amountCents,
      note,
      createdBy: adminUserId,
    }),
  ])

  revalidatePath(`/platform/${orgId}`)
  revalidatePath('/platform')
  redirect(`/platform/${orgId}`)
}

export async function addBillingNote(formData: FormData) {
  const { adminUserId } = await getPlatformContext()

  const orgId = formData.get('orgId') as string
  const note  = formData.get('note') as string

  await db.insert(billingEvents).values({
    organizationId: orgId,
    type: 'note',
    note,
    createdBy: adminUserId,
  })

  revalidatePath(`/platform/${orgId}`)
  redirect(`/platform/${orgId}`)
}
