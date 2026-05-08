'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Search, User } from 'lucide-react'
import { getSubsByCounty } from './actions'

type Sub = {
  id: string
  county: string | null
  rating: string | null
  ratingCount: number | null
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
  }
}

export function SubDirectoryClient({ counties }: { counties: string[] }) {
  const [selectedCounty, setSelectedCounty] = useState<string>('')
  const [subs, setSubs] = useState<Sub[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedCounty) { setSubs([]); return }
    setLoading(true)
    getSubsByCounty(selectedCounty)
      .then(rows => setSubs(rows as Sub[]))
      .finally(() => setLoading(false))
  }, [selectedCounty])

  const filtered = subs.filter(s => {
    if (!filter) return true
    const q = filter.toLowerCase()
    const name = `${s.user.firstName} ${s.user.lastName}`.toLowerCase()
    return name.includes(q) || s.user.email.toLowerCase().includes(q)
  })

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Find Substitutes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Browse substitutes registered in SubHub by county. These are subs across all schools, not just yours.
        </p>
      </div>

      {/* County picker */}
      <div className="relative">
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <select
          value={selectedCounty}
          onChange={e => { setSelectedCounty(e.target.value); setFilter('') }}
          className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-9 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">— Select a county —</option>
          {counties.length === 0 && (
            <option disabled>No subs have set a county yet</option>
          )}
          {counties.map(c => (
            <option key={c} value={c}>{c} County</option>
          ))}
        </select>
      </div>

      {/* Search within county */}
      {selectedCounty && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by name or email…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      )}

      {loading && (
        <p className="text-sm text-gray-400 text-center py-4">Loading substitutes…</p>
      )}

      {!loading && selectedCounty && filtered.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-8 text-center">
          <p className="text-sm text-gray-500">
            {subs.length === 0
              ? `No substitutes have registered in ${selectedCounty} County yet.`
              : 'No substitutes match your search.'}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">{filtered.length} substitute{filtered.length !== 1 ? 's' : ''} in {selectedCounty} County</p>
          {filtered.map(s => (
            <SubCard key={s.id} sub={s} />
          ))}
        </div>
      )}
    </div>
  )
}

function SubCard({ sub }: { sub: Sub }) {
  const rating = sub.rating && sub.ratingCount && sub.ratingCount > 0
    ? Number(sub.rating).toFixed(1)
    : null

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0 h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold">
        {sub.user.firstName[0]}{sub.user.lastName[0]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">
            {sub.user.firstName} {sub.user.lastName}
          </span>
          {rating && (
            <span className="text-xs text-yellow-600 font-medium">★ {rating}</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {sub.user.phone && (
            <a href={`tel:${sub.user.phone}`} className="text-xs text-blue-500 hover:underline">{sub.user.phone}</a>
          )}
          <a href={`mailto:${sub.user.email}`} className="text-xs text-blue-500 hover:underline truncate">{sub.user.email}</a>
        </div>
      </div>
    </div>
  )
}
