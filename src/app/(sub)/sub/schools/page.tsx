'use client'

/**
 * School browser for substitutes.
 *
 * Two ways to find a school:
 *   1. Type a name in the search box — searches all of California instantly
 *   2. Pick a county to browse all schools in that area
 *
 * Schools already using SubHub are highlighted with an orange badge.
 */

import { useEffect, useRef, useState } from 'react'
import { Search, School, CheckCircle, MapPin, ChevronDown, X } from 'lucide-react'
import {
  getDirectoryCountyCounts,
  getDirectorySchoolsByCounty,
  getMyProfile,
  searchDirectory,
} from '../../actions'

type DirectorySchool = {
  id: string
  schoolName: string
  districtName: string | null
  city: string | null
  address: string | null
  state: string | null
  zip: string | null
  phone: string | null
  schoolType: string | null
  gradeRange: string | null
  county: string
  claimedByOrg: { id: string; name: string } | null
}

type CountyCount = { county: string; count: number }

export default function FindSchoolsPage() {
  const [counties, setCounties] = useState<CountyCount[]>([])
  const [selectedCounty, setSelectedCounty] = useState('')
  const [countySchools, setCountySchools] = useState<DirectorySchool[]>([])
  const [loadingCounty, setLoadingCounty] = useState(false)

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<DirectorySchool[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mode: 'county' = browsing by county, 'search' = typing a name
  const mode = query.length >= 2 ? 'search' : 'county'

  // Load counties on mount; pre-select the sub's county if set
  useEffect(() => {
    getDirectoryCountyCounts().then(setCounties)
    getMyProfile().then(({ sub }) => {
      if (sub.county) setSelectedCounty(sub.county)
    })
  }, [])

  // Load all schools when county changes (only in county mode)
  useEffect(() => {
    if (!selectedCounty) { setCountySchools([]); return }
    setLoadingCounty(true)
    getDirectorySchoolsByCounty(selectedCounty)
      .then(rows => setCountySchools(rows as DirectorySchool[]))
      .finally(() => setLoadingCounty(false))
  }, [selectedCounty])

  // Debounced name search — fires 350ms after typing stops
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (query.length < 2) { setSearchResults([]); return }
    setSearching(true)
    searchTimer.current = setTimeout(() => {
      searchDirectory(query)
        .then(rows => setSearchResults(rows as DirectorySchool[]))
        .finally(() => setSearching(false))
    }, 350)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [query])

  // In county mode, filter the loaded list locally
  const [localFilter, setLocalFilter] = useState('')
  const visibleCountySchools = countySchools.filter(s => {
    if (!localFilter) return true
    const q = localFilter.toLowerCase()
    return (
      s.schoolName.toLowerCase().includes(q) ||
      s.districtName?.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q)
    )
  })

  const onSubHub = visibleCountySchools.filter(s => s.claimedByOrg)
  const others   = visibleCountySchools.filter(s => !s.claimedByOrg)

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Find Schools</h1>
        <p className="text-sm text-gray-500 mt-1">
          Search by name, or pick a county to browse all schools in that area.
        </p>
      </div>

      {/* Name search — always visible */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by school name, district, or city…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-300 pl-9 pr-9 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Search mode ── */}
      {mode === 'search' && (
        <div className="space-y-2">
          {searching && (
            <p className="text-sm text-gray-400 text-center py-4">Searching…</p>
          )}
          {!searching && searchResults.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No schools found for &ldquo;{query}&rdquo;</p>
          )}
          {!searching && searchResults.length > 0 && (
            <>
              <p className="text-xs text-gray-400">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;</p>
              {searchResults.map(s => <SchoolCard key={s.id} school={s} showCounty />)}
            </>
          )}
        </div>
      )}

      {/* ── County browse mode ── */}
      {mode === 'county' && (
        <>
          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or browse by county</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* County picker */}
          <div className="relative">
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={selectedCounty}
              onChange={e => { setSelectedCounty(e.target.value); setLocalFilter('') }}
              className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-9 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="">— Select a county —</option>
              {counties.map(c => (
                <option key={c.county} value={c.county}>
                  {c.county} County ({c.count} schools)
                </option>
              ))}
            </select>
          </div>

          {/* Filter within county */}
          {selectedCounty && !loadingCounty && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={`Filter within ${selectedCounty} County…`}
                value={localFilter}
                onChange={e => setLocalFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          )}

          {loadingCounty && (
            <p className="text-sm text-gray-400 text-center py-4">Loading schools…</p>
          )}

          {/* On SubHub */}
          {onSubHub.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-orange-600 mb-2">
                On SubHub ({onSubHub.length})
              </h2>
              <div className="space-y-2">
                {onSubHub.map(s => <SchoolCard key={s.id} school={s} />)}
              </div>
            </section>
          )}

          {/* Other schools */}
          {others.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Other Schools in {selectedCounty} County ({others.length})
              </h2>
              <div className="space-y-2">
                {others.map(s => <SchoolCard key={s.id} school={s} />)}
              </div>
            </section>
          )}

          {selectedCounty && !loadingCounty && visibleCountySchools.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No schools match your filter.</p>
          )}
        </>
      )}
    </div>
  )
}

function SchoolCard({ school, showCounty = false }: { school: DirectorySchool; showCounty?: boolean }) {
  const onSubHub = !!school.claimedByOrg
  const location = showCounty
    ? [school.city, `${school.county} County`].filter(Boolean).join(' · ')
    : [school.city, school.state].filter(Boolean).join(', ')

  return (
    <div className={`rounded-lg border bg-white px-4 py-3 flex items-start gap-3 ${
      onSubHub ? 'border-orange-200' : 'border-gray-200'
    }`}>
      <div className={`mt-0.5 flex-shrink-0 rounded-full p-1.5 ${
        onSubHub ? 'bg-orange-50' : 'bg-gray-50'
      }`}>
        {onSubHub
          ? <CheckCircle className="h-4 w-4 text-orange-500" />
          : <School className="h-4 w-4 text-gray-400" />
        }
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{school.schoolName}</span>
          {onSubHub && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
              On SubHub
            </span>
          )}
        </div>
        {school.districtName && (
          <p className="text-xs text-gray-500 mt-0.5">{school.districtName}</p>
        )}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {location && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <MapPin className="h-3 w-3" />{location}
            </span>
          )}
          {school.gradeRange && (
            <span className="text-xs text-gray-400">Grades {school.gradeRange}</span>
          )}
          {school.schoolType && (
            <span className="text-xs text-gray-400">{school.schoolType}</span>
          )}
        </div>
      </div>
    </div>
  )
}
