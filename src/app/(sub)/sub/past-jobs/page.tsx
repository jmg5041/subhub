import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, organizations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import PastJobsClient from './PastJobsClient'

export default async function PastJobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!profile) redirect('/auth/login')

  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, profile.organizationId) })
  const timezone = org?.timezone ?? 'America/Los_Angeles'

  return <PastJobsClient timezone={timezone} />
}
