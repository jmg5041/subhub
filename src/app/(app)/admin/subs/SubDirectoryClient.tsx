'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, FileText, Search, Star } from 'lucide-react'
import { getSubsByCounty } from './actions'

type Sub = {
  id: string
  county: string | null
  rating: string | null
  ratingCount: number | null
  resumeUrl: string | null
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
  }
}

export function SubDirectoryClient({ counties, ownSubUserIds }: { counties: string[], ownSubUserIds: string[] }) {
  const [selectedCounty, setSelectedCounty] = useState<string>('')
  const [subs, setSubs] = useState<Sub[]>([])
  const [filter, setFilter] = useState('')
  const [excludeOwn, setExcludeOwn] = useState(true)
  const [loading, setLoading] = useState(false)

  const ownSet = new Set(ownSubUserIds)

  useEffect(() => {
    if (!selectedCounty) { setSubs([]); return }
    setLoading(true)
    getSubsByCounty(selectedCounty)
      .then(rows => setSubs(rows as Sub[]))
      .finally(() => setLoading(false))
  }, [selectedCounty])

  const filtered = subs.filter(s => {
    if (excludeOwn && ownSet.has(s.user.id)) return false
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

      {/* Exclude own subs toggle */}
      {ownSubUserIds.length > 0 && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={excludeOwn}
            onChange={e => setExcludeOwn(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">Exclude substitutes already in your roster</span>
        </label>
      )}

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
      <div className="mt-0.5 flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold">
        {sub.user.firstName[0]}{sub.user.lastName[0]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">
            {sub.user.firstName} {sub.user.lastName}
          </span>
          {rating ? (
            <span className="flex items-center gap-0.5 text-xs text-yellow-600 font-medium">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {rating} <span className="text-gray-400 font-normal">({sub.ratingCount})</span>
            </span>
          ) : (
            <span className="text-xs text-gray-300">No rating yet</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {sub.user.phone && (
            <a href={`tel:${sub.user.phone}`} className="text-xs text-blue-500 hover:underline">{sub.user.phone}</a>
          )}
          <a href={`mailto:${sub.user.email}`} className="text-xs text-blue-500 hover:underline truncate">{sub.user.email}</a>
          {sub.resumeUrl && (
            <a href={sub.resumeUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
              <FileText className="h-3 w-3" /> Resume
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
