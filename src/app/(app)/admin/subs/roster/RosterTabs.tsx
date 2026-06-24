'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Phone, Mail, MapPin, Star } from 'lucide-react'
import PriorityTab from './PriorityTab'

type Sub = {
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
  userStatus: string | null
}

type School = { id: string; name: string; priorityCallingEnabled: boolean }

type Props = {
  subs: Sub[]
  schools: School[]
  priorityBySchool: Record<string, string[]>
  subSchools: Record<string, { id: string; name: string }[]>
  activeSubsBySchool: Record<string, string[]>
}

export default function RosterTabs({ subs, schools, priorityBySchool, subSchools, activeSubsBySchool }: Props) {
  const [tab, setTab] = useState<'roster' | 'priority'>('roster')

  const active = subs.filter(s => s.userStatus === 'active')
  const inactive = subs.filter(s => s.userStatus !== 'active')

  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {(['roster', 'priority'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'roster' ? 'Sub Roster' : 'Call Priority Order'}
          </button>
        ))}
      </div>

      {tab === 'roster' && (
        <div className="space-y-6">
          {subs.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white px-6 py-16 text-center">
              <p className="font-medium text-gray-900">No substitutes yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Add substitutes from <strong>Admin → Manage Users</strong> or find them via <strong>Hire Subs</strong>.
              </p>
            </div>
          ) : (
            <>
              <SubTable subs={active} subSchools={subSchools} />
              {inactive.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Inactive</h2>
                  <SubTable subs={inactive} subSchools={subSchools} dim />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'priority' && (
        <PriorityTab subs={active} schools={schools} priorityBySchool={priorityBySchool} activeSubsBySchool={activeSubsBySchool} />
      )}
    </div>
  )
}

function SubTable({ subs, subSchools, dim }: { subs: Sub[]; subSchools: Record<string, { id: string; name: string }[]>; dim?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-lg border border-gray-200 bg-white ${dim ? 'opacity-60' : ''}`}>
      <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        <span>Name</span>
        <span>Contact</span>
        <span>County</span>
        <span>Schools</span>
        <span>Rating</span>
        <span>Resume</span>
      </div>
      {subs.map(sub => {
        const assignedSchools = subSchools[sub.id] ?? []
        return (
        <Link
          key={sub.id}
          href={`/admin/subs/roster/${sub.id}`}
          className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-2 md:gap-4 items-start md:items-center border-b border-gray-100 px-5 py-4 last:border-0 hover:bg-blue-50 transition-colors cursor-pointer"
        >
          {/* Name + avatar */}
          <div className="flex items-center gap-3">
            {sub.avatarUrl ? (
              <Image src={sub.avatarUrl} alt="" width={36} height={36} className="rounded-full object-cover flex-shrink-0" />
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

          {/* Schools */}
          <div className="text-sm text-gray-500">
            {assignedSchools.length === 0 ? (
              <span className="text-gray-300">—</span>
            ) : assignedSchools.length === 1 ? (
              <span className="truncate">{assignedSchools[0].name.replace('Southlands Christian ', '')}</span>
            ) : (
              <span className="text-blue-600">{assignedSchools.length} schools</span>
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
              <span className="text-xs text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>
                <a href={sub.resumeUrl} target="_blank" rel="noopener noreferrer">View</a>
              </span>
            ) : (
              <span className="text-xs text-gray-300">—</span>
            )}
          </div>
        </Link>
        )
      })}
    </div>
  )
}
