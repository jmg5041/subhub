import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const targetUserId = (formData.get('targetUserId') as string | null) ?? user.id

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // If uploading for someone else, verify the caller is admin/principal
  if (targetUserId !== user.id) {
    const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
    if (!profile || !['admin', 'principal'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // Verify target user is in the same org
    const target = await db.query.users.findFirst({ where: eq(users.id, targetUserId) })
    if (!target || target.organizationId !== profile.organizationId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
  }

  const bytes = await file.arrayBuffer()
  const adminStorage = createAdminClient().storage

  const { error } = await adminStorage
    .from('absence-attachments')
    .upload(`avatars/${targetUserId}`, bytes, { upsert: true, contentType: 'image/jpeg' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = adminStorage
    .from('absence-attachments')
    .getPublicUrl(`avatars/${targetUserId}`)

  return NextResponse.json({ url: publicUrl })
}
