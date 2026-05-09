import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { users, substitutes } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { UserCog, Phone, Mail, MapPin, Star } from 'lucide-react'

export default async function SubRosterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const me = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (!me) return null

  const subs = await db
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
    .where(eq(users.organizationId, me.organizationId))
    .orderBy(asc(users.lastName), asc(users.firstName))

  const active = subs.filter(s => s.userStatus === 'active')
  const inactive = subs.filter(s => s.userStatus === 'inactive')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserCog className="h-8 w-8 text-blue-600 flex-shrink-0" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage & Review Subs</h1>
          <p className="text-gray-500 mt-0.5">All substitutes in your organization — {active.length} active</p>
        </div>
      </div>

      {subs.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-16 text-center">
          <UserCog className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-900">No substitutes yet</p>
          <p className="text-sm text-gray-500 mt-1">Add substitutes from <strong>Admin → Manage Users</strong> or find them via <strong>Hire Subs</strong>.</p>
        </div>
      ) : (
        <>
          <SubTable subs={active} />
          {inactive.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Inactive</h2>
              <SubTable subs={inactive} dim />
            </div>
          )}
        </>
      )}
    </div>
  )
}

type SubRow = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  county: string | null
  rating: string | null
  ratingCount: number | null
  resumeUrl: string | null
  avatarUrl: string | null
  status: string | null
}

function SubTable({ subs, dim }: { subs: SubRow[]; dim?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-lg border border-gray-200 bg-white ${dim ? 'opacity-60' : ''}`}>
      <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        <span>Name</span>
        <span>Contact</span>
        <span>County</span>
        <span>Rating</span>
        <span>Resume</span>
      </div>
      {subs.map(sub => (
        <div
          key={sub.id}
          className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr_auto] gap-2 md:gap-4 items-start md:items-center border-b border-gray-100 px-5 py-4 last:border-0 hover:bg-gray-50"
        >
          {/* Name + avatar */}
          <div className="flex items-center gap-3">
            {sub.avatarUrl ? (
              <img src={sub.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                {sub.firstName[0]}{sub.lastName[0]}
              </div>
            )}
            <span className="font-medium text-gray-900 text-sm">{sub.lastName}, {sub.firstName}</span>
          </div>

          {/* Contact */}
          <div className="space-y-0.5">
            {sub.email && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Mail className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{sub.email}</span>
              </div>
            )}
            {sub.phone && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Phone className="h-3 w-3 flex-shrink-0" />
                <span>{sub.phone}</span>
              </div>
            )}
          </div>

          {/* County */}
          <div className="text-sm text-gray-500">
            {sub.county ? (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                {sub.county}
              </span>
            ) : (
              <span className="text-gray-300">—</span>
            )}
          </div>

          {/* Rating */}
          <div className="text-sm text-gray-500">
            {sub.ratingCount && sub.ratingCount > 0 ? (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                {parseFloat(sub.rating ?? '0').toFixed(1)}
                <span className="text-xs text-gray-400">({sub.ratingCount})</span>
              </span>
            ) : (
              <span className="text-gray-300">No ratings</span>
            )}
          </div>

          {/* Resume */}
          <div>
            {sub.resumeUrl ? (
              <a
                href={sub.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                View
              </a>
            ) : (
              <span className="text-xs text-gray-300">—</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
