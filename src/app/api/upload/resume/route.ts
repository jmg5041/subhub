import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/db'
import { substitutes } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the user is a substitute
  const sub = await db.query.substitutes.findFirst({ where: eq(substitutes.userId, user.id) })
  if (!sub) return NextResponse.json({ error: 'Substitute profile required' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const adminStorage = createAdminClient().storage

  const { error } = await adminStorage
    .from('absence-attachments')
    .upload(`resumes/${user.id}.pdf`, bytes, { upsert: true, contentType: 'application/pdf' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = adminStorage
    .from('absence-attachments')
    .getPublicUrl(`resumes/${user.id}.pdf`)

  return NextResponse.json({ url: publicUrl })
}
