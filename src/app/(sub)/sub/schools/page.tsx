'use client'

/**
 * School browser for substitutes — three ways to find a school:
 *   1. Nearby — use device location or enter a zip to find schools within X miles
 *   2. Search — type a name, district, or city across all of California
 *   3. Browse — pick a county and scroll through all schools in that area
 *
 * Each school card is expandable to show address, directions, and phone.
 * Schools already using SubHub are highlighted with an orange badge.
 */

import { useEffect, useRef, useState } from 'react'
import {
  Search, School, CheckCircle, MapPin, ChevronDown, X,
  Phone, Navigation, ChevronRight, Loader2, LocateFixed,
} from 'lucide-react'
import {
  getDirectoryCountyCounts,
  getDirectorySchoolsByCounty,
  getMyProfile,
  searchDirectory,
  searchSchoolsNearby,
} from '../../actions'

type DirectorySchool = {
  id: string
  schoolName?: string
  school_name?: string
  districtName?: string | null
  district_name?: string | null
  city: string | null
  address: string | null
  state: string | null
  zip: string | null
  phone: string | null
  schoolType?: string | null
  school_type?: string | null
  gradeRange?: string | null
  grade_range?: string | null
  county: string
  claimedByOrg?: { id: string; name: string } | null
  claimed_by_org_id?: string | null
  distance_miles?: number
}

// Normalise snake_case (proximity results) and camelCase (drizzle results) to one shape
function norm(s: DirectorySchool) {
  return {
    id:           s.id,
    schoolName:   s.schoolName  ?? s.school_name  ?? '',
    districtName: s.districtName ?? s.district_name ?? null,
    city:         s.city,
    address:      s.address,
    state:        s.state,
    zip:          s.zip,
    phone:        s.phone,
    schoolType:   s.schoolType  ?? s.school_type  ?? null,
    gradeRange:   s.gradeRange  ?? s.grade_range  ?? null,
    county:       s.county,
    onSubHub:     !!(s.claimedByOrg ?? s.claimed_by_org_id),
    distanceMiles: s.distance_miles ?? null,
  }
}

type NormSchool = ReturnType<typeof norm>
type CountyCount = { county: string; count: number }
type Mode = 'nearby' | 'search' | 'county'

const RADIUS_OPTIONS = [5, 10, 15, 25, 50]

export default function FindSchoolsPage() {
  const [mode, setMode] = useState<Mode>('nearby')

  // Nearby state
  const [radius, setRadius]           = useState(15)
  const [locating, setLocating]       = useState(false)
  const [locationError, setLocationError] = useState('')
  const [nearbyResults, setNearbyResults] = useState<NormSchool[]>([])
  const [nearbyLoading, setNearbyLoading] = useState(false)

  // Search state
  const [query, setQuery]             = useState('')
  const [searchResults, setSearchResults] = useState<NormSchool[]>([])
  const [searching, setSearching]     = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // County browse state
  const [counties, setCounties]       = useState<CountyCount[]>([])
  const [selectedCounty, setSelectedCounty] = useState('')
  const [countySchools, setCountySchools]   = useState<NormSchool[]>([])
  const [localFilter, setLocalFilter] = useState('')
  const [loadingCounty, setLoadingCounty]   = useState(false)

  // Load counties + pre-select sub's saved county on mount
  useEffect(() => {
    getDirectoryCountyCounts().then(setCounties)
    getMyProfile().then(({ sub }) => { if (sub.county) setSelectedCounty(sub.county) })
  }, [])

  // County schools
  useEffect(() => {
    if (!selectedCounty) { setCountySchools([]); return }
    setLoadingCounty(true)
    getDirectorySchoolsByCounty(selectedCounty)
      .then(rows => setCountySchools((rows as DirectorySchool[]).map(norm)))
      .finally(() => setLoadingCounty(false))
  }, [selectedCounty])

  // Debounced name search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (query.length < 2) { setSearchResults([]); return }
    setSearching(true)
    searchTimer.current = setTimeout(() => {
      searchDirectory(query)
        .then(rows => setSearchResults((rows as DirectorySchool[]).map(norm)))
        .finally(() => setSearching(false))
    }, 350)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [query])

  function useDeviceLocation() {
    setLocating(true)
    setLocationError('')
    setNearbyResults([])
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false)
        loadNearby(pos.coords.latitude, pos.coords.longitude)
      },
      () => {
        setLocating(false)
        setLocationError('Could not get your location. Try entering a zip code instead.')
      },
      { timeout: 10000 }
    )
  }

  async function loadNearby(lat: number, lng: number) {
    setNearbyLoading(true)
    try {
      const rows = await searchSchoolsNearby(lat, lng, radius)
      setNearbyResults((rows as unknown as DirectorySchool[]).map(norm))
    } finally {
      setNearbyLoading(false)
    }
  }

  // County filter
  const filteredCounty = countySchools.filter(s => {
    if (!localFilter) return true
    const q = localFilter.toLowerCase()
    return s.schoolName.toLowerCase().includes(q) ||
      s.districtName?.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q)
  })
  const onSubHubCounty = filteredCounty.filter(s => s.onSubHub)
  const othersCounty   = filteredCounty.filter(s => !s.onSubHub)

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Find Schools</h1>
        <p className="text-sm text-gray-500 mt-1">Find schools near you, search by name, or browse by county.</p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {([['nearby', 'Nearby'], ['search', 'Search'], ['county', 'Browse County']] as [Mode, string][]).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Nearby mode ── */}
      {mode === 'nearby' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={useDeviceLocation}
              disabled={locating || nearbyLoading}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              {locating ? 'Getting location…' : 'Use my location'}
            </button>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>within</span>
              <select
                value={radius}
                onChange={e => setRadius(Number(e.target.value))}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {RADIUS_OPTIONS.map(r => (
                  <option key={r} value={r}>{r} miles</option>
                ))}
              </select>
            </div>
          </div>

          {locationError && (
            <p className="text-sm text-red-500">{locationError}</p>
          )}

          {nearbyLoading && (
            <p className="text-sm text-gray-400 text-center py-6">Finding schools nearby…</p>
          )}

          {!nearbyLoading && nearbyResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">{nearbyResults.length} school{nearbyResults.length !== 1 ? 's' : ''} within {radius} miles</p>
              {nearbyResults.map(s => <SchoolCard key={s.id} school={s} showDistance />)}
            </div>
          )}

          {!nearbyLoading && nearbyResults.length === 0 && !locating && (
            <div className="rounded-lg border border-dashed border-gray-200 px-6 py-10 text-center text-sm text-gray-400">
              Tap &ldquo;Use my location&rdquo; to find schools near you.
            </div>
          )}
        </div>
      )}

      {/* ── Search mode ── */}
      {mode === 'search' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="School name, district, or city…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-gray-300 pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {searching && <p className="text-sm text-gray-400 text-center py-4">Searching…</p>}

          {!searching && query.length >= 2 && searchResults.length === 0 && (
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
        <div className="space-y-3">
          <div className="relative">
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={selectedCounty}
              onChange={e => { setSelectedCounty(e.target.value); setLocalFilter('') }}
              className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="">— Select a county —</option>
              {counties.map(c => (
                <option key={c.county} value={c.county}>{c.county} County ({c.count} schools)</option>
              ))}
            </select>
          </div>

          {selectedCounty && !loadingCounty && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={`Filter within ${selectedCounty} County…`}
                value={localFilter}
                onChange={e => setLocalFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          )}

          {loadingCounty && <p className="text-sm text-gray-400 text-center py-4">Loading schools…</p>}

          {onSubHubCounty.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-orange-600 mb-2">On SubHub ({onSubHubCounty.length})</h2>
              <div className="space-y-2">{onSubHubCounty.map(s => <SchoolCard key={s.id} school={s} />)}</div>
            </section>
          )}
          {othersCounty.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Other Schools in {selectedCounty} County ({othersCounty.length})
              </h2>
              <div className="space-y-2">{othersCounty.map(s => <SchoolCard key={s.id} school={s} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function SchoolCard({ school, showCounty = false, showDistance = false }: {
  school: NormSchool
  showCounty?: boolean
  showDistance?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const location = showCounty
    ? [school.city, `${school.county} County`].filter(Boolean).join(' · ')
    : [school.city, school.state].filter(Boolean).join(', ')

  const mapsUrl = school.address
    ? `https://maps.google.com/?q=${encodeURIComponent([school.address, school.city, school.state].filter(Boolean).join(', '))}`
    : `https://maps.google.com/?q=${encodeURIComponent(school.schoolName)}`

  return (
    <div className={`rounded-lg border bg-white overflow-hidden ${school.onSubHub ? 'border-orange-200' : 'border-gray-200'}`}>
      {/* Collapsed row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className={`mt-0.5 flex-shrink-0 rounded-full p-1.5 ${school.onSubHub ? 'bg-orange-50' : 'bg-gray-50'}`}>
          {school.onSubHub
            ? <CheckCircle className="h-4 w-4 text-orange-500" />
            : <School className="h-4 w-4 text-gray-400" />
          }
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{school.schoolName}</span>
            {school.onSubHub && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">On SubHub</span>
            )}
          </div>
          {school.districtName && <p className="text-xs text-gray-500 mt-0.5">{school.districtName}</p>}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {location && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <MapPin className="h-3 w-3" />{location}
              </span>
            )}
            {showDistance && school.distanceMiles != null && (
              <span className="text-xs font-medium text-orange-600">
                {school.distanceMiles < 1
                  ? `${(school.distanceMiles * 5280).toFixed(0)} ft`
                  : `${school.distanceMiles.toFixed(1)} mi`}
              </span>
            )}
            {school.gradeRange && <span className="text-xs text-gray-400">Grades {school.gradeRange}</span>}
          </div>
        </div>
        <ChevronRight className={`h-4 w-4 flex-shrink-0 text-gray-300 mt-1 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2 bg-gray-50">
          {school.address && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-700">{school.address}</p>
                <p className="text-sm text-gray-700">{school.city}{school.state && `, ${school.state}`}{school.zip && ` ${school.zip}`}</p>
              </div>
            </div>
          )}
          {school.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <a href={`tel:${school.phone}`} className="text-sm text-blue-600 hover:underline">{school.phone}</a>
            </div>
          )}
          <div className="flex gap-2 pt-1 flex-wrap">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              <Navigation className="h-3.5 w-3.5" /> Get Directions
            </a>
            {school.phone && (
              <a
                href={`tel:${school.phone}`}
                className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Phone className="h-3.5 w-3.5" /> Call School
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
