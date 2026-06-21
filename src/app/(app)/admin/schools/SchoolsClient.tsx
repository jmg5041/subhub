'use client'

/**
 * Interactive school edit cards.
 *
 * Each card has two expandable sections:
 *   1. Edit form — update name, address, hours, phone, website
 *   2. Directory search — find the school in the CA directory and import its info
 */

import { useState, useTransition } from 'react'
import { Pencil, Check, X, Loader2, MapPin, Phone, Globe, Clock, Search, BookOpen, CheckCircle2 } from 'lucide-react'
import { updateSchool, searchDirectory, claimDirectorySchool } from '../actions'

type School = {
  id: string
  name: string
  campus: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  county: string | null
  phone: string | null
  website: string | null
  dayStartTime: string | null
  dayEndTime: string | null
}

type DirectoryEntry = {
  id: string
  schoolName: string
  districtName: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  county: string
  phone: string | null
  gradeRange: string | null
  schoolType: string | null
  claimedByOrg: { id: string; name: string } | null
}

function sliceTime(t: string | null): string {
  return t?.slice(0, 5) ?? ''
}

export default function SchoolsClient({ schools }: { schools: School[] }) {
  return (
    <div className="space-y-3">
      {schools.map(school => (
        <SchoolCard key={school.id} school={school} />
      ))}
    </div>
  )
}

function SchoolCard({ school }: { school: School }) {
  const [editing, setEditing]     = useState(false)
  const [saving, startSave]       = useTransition()
  const [error, setError]         = useState('')
  const [saved, setSaved]         = useState(school)

  // Directory search state
  const [dirOpen, setDirOpen]     = useState(false)
  const [dirQuery, setDirQuery]   = useState('')
  const [dirResults, setDirResults] = useState<DirectoryEntry[]>([])
  const [dirSearching, startSearch] = useTransition()
  const [dirClaiming, startClaim]   = useTransition()
  const [claimError, setClaimError] = useState('')
  const [claimed, setClaimed]       = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startSave(async () => {
      const res = await updateSchool(fd)
      if ('error' in res) {
        setError(res.error ?? 'Save failed.')
      } else {
        setSaved({
          ...saved,
          name:         fd.get('name') as string,
          campus:       (fd.get('campus') as string) || null,
          address:      (fd.get('address') as string) || null,
          city:         (fd.get('city') as string) || null,
          state:        (fd.get('state') as string) || null,
          zip:          (fd.get('zip') as string) || null,
          county:       (fd.get('county') as string) || null,
          phone:        (fd.get('phone') as string) || null,
          website:      (fd.get('website') as string) || null,
          dayStartTime: (fd.get('dayStartTime') as string) || saved.dayStartTime,
          dayEndTime:   (fd.get('dayEndTime') as string) || saved.dayEndTime,
        })
        setEditing(false)
      }
    })
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (dirQuery.trim().length < 2) return
    startSearch(async () => {
      const results = await searchDirectory(dirQuery)
      setDirResults(results as DirectoryEntry[])
    })
  }

  function handleClaim(entry: DirectoryEntry) {
    setClaimError('')
    startClaim(async () => {
      const res = await claimDirectorySchool(saved.id, entry.id)
      if ('error' in res) {
        setClaimError(res.error ?? 'Could not link school.')
      } else {
        // Update the displayed info to match the directory entry
        setSaved(prev => ({
          ...prev,
          address: entry.address ?? prev.address,
          city:    entry.city    ?? prev.city,
          state:   entry.state   ?? prev.state,
          zip:     entry.zip     ?? prev.zip,
          phone:   entry.phone   ?? prev.phone,
          county:  entry.county,
        }))
        setClaimed(true)
        setDirOpen(false)
      }
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Summary row */}
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{saved.name}</span>
            {claimed && (
              <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                <CheckCircle2 className="h-3 w-3" /> Linked to directory
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-400">
            {saved.campus && (
              <span className="text-blue-500 font-medium">{saved.campus}</span>
            )}
            {saved.address && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {saved.address}{saved.city && `, ${saved.city}`}
                {saved.county && ` · ${saved.county} Co.`}
              </span>
            )}
            {saved.phone && (
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{saved.phone}</span>
            )}
            {saved.website && (
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />{saved.website.replace(/^https?:\/\//, '')}
              </span>
            )}
            {saved.dayStartTime && saved.dayEndTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {sliceTime(saved.dayStartTime)} – {sliceTime(saved.dayEndTime)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!editing && (
            <button
              type="button"
              onClick={() => { setEditing(true); setDirOpen(false) }}
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          )}
          {!dirOpen && !editing && (
            <button
              type="button"
              onClick={() => { setDirOpen(true); setDirQuery(saved.name) }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"
              title="Find this school in the CA directory to import address, phone, and county"
            >
              <BookOpen className="h-3 w-3" /> Find in directory
            </button>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <form onSubmit={handleSubmit} className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50">
          <input type="hidden" name="id" value={saved.id} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">School Name</label>
              <input name="name" defaultValue={saved.name} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Campus</label>
              <input name="campus" defaultValue={saved.campus ?? ''} placeholder="e.g. Main Campus, North Campus"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
              <p className="text-xs text-gray-400 mt-1">Schools sharing the same campus name are treated as co-located.</p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Street Address</label>
              <input name="address" defaultValue={saved.address ?? ''} placeholder="123 Main St"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
              <input name="city" defaultValue={saved.city ?? ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                <input name="state" defaultValue={saved.state ?? 'CA'} maxLength={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 uppercase" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Zip</label>
                <input name="zip" defaultValue={saved.zip ?? ''}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">County</label>
              <input name="county" defaultValue={saved.county ?? ''} placeholder="e.g. Los Angeles"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Main Office Phone</label>
              <input name="phone" type="tel" defaultValue={saved.phone ?? ''} placeholder="(555) 555-5555"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
              <input name="website" type="url" defaultValue={saved.website ?? ''} placeholder="https://school.edu"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">School Day Start</label>
              <input name="dayStartTime" type="time" defaultValue={sliceTime(saved.dayStartTime)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">School Day End</label>
              <input name="dayEndTime" type="time" defaultValue={sliceTime(saved.dayEndTime)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save
            </button>
            <button type="button" onClick={() => { setEditing(false); setError('') }} disabled={saving}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        </form>
      )}

      {/* Directory search panel */}
      {dirOpen && (
        <div className="border-t border-gray-100 px-5 py-4 bg-blue-50 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-blue-700">
              Find in CA School Directory
            </p>
            <button onClick={() => { setDirOpen(false); setDirResults([]) }}
              className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-blue-600">
            Search the official CA directory to import address, phone number, and county — then click &ldquo;Use this school&rdquo; to apply it.
          </p>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={dirQuery}
                onChange={e => setDirQuery(e.target.value)}
                placeholder="School name or city…"
                className="w-full rounded-md border border-gray-300 bg-white pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <button type="submit" disabled={dirSearching || dirQuery.trim().length < 2}
              className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white font-medium hover:bg-blue-500 disabled:opacity-50">
              {dirSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Search
            </button>
          </form>

          {claimError && <p className="text-xs text-red-600">{claimError}</p>}

          {dirResults.length > 0 && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {dirResults.map(entry => (
                <div key={entry.id}
                  className="rounded-md border border-gray-200 bg-white px-3 py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">{entry.schoolName}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {[entry.address, entry.city, entry.county && `${entry.county} County`].filter(Boolean).join(' · ')}
                    </div>
                    <div className="flex gap-2 mt-0.5 flex-wrap">
                      {entry.gradeRange && <span className="text-xs text-gray-400">Grades {entry.gradeRange}</span>}
                      {entry.phone && <span className="text-xs text-gray-400">{entry.phone}</span>}
                      {entry.claimedByOrg && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                          On SubHub
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleClaim(entry)}
                    disabled={dirClaiming}
                    className="flex-shrink-0 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 whitespace-nowrap"
                  >
                    {dirClaiming ? 'Linking…' : 'Use this school'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {!dirSearching && dirResults.length === 0 && dirQuery.length >= 2 && (
            <p className="text-xs text-gray-400 text-center py-2">
              Submit a search to see results.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
