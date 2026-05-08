'use client'

/**
 * Interactive school edit cards.
 * Each school has a collapsed summary row; clicking Edit expands an inline form.
 */

import { useState, useTransition } from 'react'
import { Pencil, Check, X, Loader2, MapPin, Phone, Globe, Clock } from 'lucide-react'
import { updateSchool } from '../actions'

type School = {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  website: string | null
  dayStartTime: string | null
  dayEndTime: string | null
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
  const [editing, setEditing] = useState(false)
  const [saving, startSave]   = useTransition()
  const [error, setError]     = useState('')
  const [saved, setSaved]     = useState(school)

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
          address:      (fd.get('address') as string) || null,
          city:         (fd.get('city') as string) || null,
          state:        (fd.get('state') as string) || null,
          zip:          (fd.get('zip') as string) || null,
          phone:        (fd.get('phone') as string) || null,
          website:      (fd.get('website') as string) || null,
          dayStartTime: (fd.get('dayStartTime') as string) || saved.dayStartTime,
          dayEndTime:   (fd.get('dayEndTime') as string) || saved.dayEndTime,
        })
        setEditing(false)
      }
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Summary row */}
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900">{saved.name}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-400">
            {saved.address && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {saved.address}{saved.city && `, ${saved.city}`}
              </span>
            )}
            {saved.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {saved.phone}
              </span>
            )}
            {saved.website && (
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {saved.website.replace(/^https?:\/\//, '')}
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
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 flex-shrink-0"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>

      {/* Edit form */}
      {editing && (
        <form onSubmit={handleSubmit} className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50">
          <input type="hidden" name="id" value={saved.id} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">School Name</label>
              <input
                name="name"
                defaultValue={saved.name}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Street Address</label>
              <input
                name="address"
                defaultValue={saved.address ?? ''}
                placeholder="123 Main St"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
              <input
                name="city"
                defaultValue={saved.city ?? ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                <input
                  name="state"
                  defaultValue={saved.state ?? 'CA'}
                  maxLength={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Zip</label>
                <input
                  name="zip"
                  defaultValue={saved.zip ?? ''}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Main Office Phone</label>
              <input
                name="phone"
                type="tel"
                defaultValue={saved.phone ?? ''}
                placeholder="(555) 555-5555"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
              <input
                name="website"
                type="url"
                defaultValue={saved.website ?? ''}
                placeholder="https://school.edu"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">School Day Start</label>
              <input
                name="dayStartTime"
                type="time"
                defaultValue={sliceTime(saved.dayStartTime)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">School Day End</label>
              <input
                name="dayEndTime"
                type="time"
                defaultValue={sliceTime(saved.dayEndTime)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError('') }}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
