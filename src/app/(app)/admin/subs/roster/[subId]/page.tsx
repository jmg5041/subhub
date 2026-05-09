import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, substitutes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, Mail, Phone, MapPin, Star, FileText } from 'lucide-react'
import { notFound } from 'next/navigation'

export default async function SubDetailPage({ params }: { params: Promise<{ subId: string }> }) {
  const { subId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const me = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!me) return null

  const [sub] = await db
    .select({
      id: substitutes.id,
      status: substitutes.status,
      county: substitutes.county,
      rating: substitutes.rating,
      ratingCount: substitutes.ratingCount,
      resumeUrl: substitutes.resumeUrl,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      userStatus: users.status,
    })
    .from(substitutes)
    .innerJoin(users, eq(substitutes.userId, users.id))
    .where(eq(substitutes.id, subId))

  if (!sub || me.organizationId !== me.organizationId) notFound()

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/admin/subs/roster" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
        <ChevronLeft className="h-4 w-4" />
        Back to Sub Roster
      </Link>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-4 mb-6">
          {sub.avatarUrl ? (
            <Image src={sub.avatarUrl} alt="" width={64} height={64} className="rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold flex-shrink-0">
              {sub.firstName[0]}{sub.lastName[0]}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">{sub.firstName} {sub.lastName}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-1 ${
              sub.userStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {sub.userStatus === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <dl className="space-y-3">
          {sub.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-700">{sub.email}</span>
            </div>
          )}
          {sub.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-700">{sub.phone}</span>
            </div>
          )}
          {sub.county && (
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-700">{sub.county} County</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <Star className="h-4 w-4 text-gray-400 flex-shrink-0" />
            {sub.ratingCount && sub.ratingCount > 0 ? (
              <span className="text-gray-700">
                {parseFloat(sub.rating ?? '0').toFixed(1)} / 5.0
                <span className="text-gray-400 ml-1">({sub.ratingCount} ratings)</span>
              </span>
            ) : (
              <span className="text-gray-400">No ratings yet</span>
            )}
          </div>
          {sub.resumeUrl && (
            <div className="flex items-center gap-3 text-sm">
              <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <a href={sub.resumeUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                View resume
              </a>
            </div>
          )}
        </dl>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900 mb-2">School Assignments</h2>
        <p className="text-sm text-gray-400">School association coming soon.</p>
      </div>
    </div>
  )
}
