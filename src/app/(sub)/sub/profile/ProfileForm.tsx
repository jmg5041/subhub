'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { updateMyProfile } from '../../actions'

export function ProfileForm({
  firstName,
  lastName,
  email,
  phone,
  county,
  counties,
}: {
  firstName: string
  lastName: string
  email: string
  phone: string
  county: string
  counties: string[]
}) {
  const [phoneVal, setPhoneVal] = useState(phone)
  const [countyVal, setCountyVal] = useState(county)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateMyProfile({ county: countyVal, phone: phoneVal })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
      {/* Name (read-only) */}
      <div className="px-5 py-4">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Name</label>
        <p className="text-sm text-gray-800">{firstName} {lastName}</p>
      </div>

      {/* Email (read-only) */}
      <div className="px-5 py-4">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Email</label>
        <p className="text-sm text-gray-800">{email}</p>
      </div>

      {/* Phone (editable) */}
      <div className="px-5 py-4">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
          Phone
        </label>
        <input
          type="tel"
          value={phoneVal}
          onChange={e => setPhoneVal(e.target.value)}
          placeholder="(555) 000-0000"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* County (editable) */}
      <div className="px-5 py-4">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
          County
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Your county is used to show you nearby schools in the Find Schools browser.
        </p>
        <div className="relative">
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={countyVal}
            onChange={e => setCountyVal(e.target.value)}
            className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">— Not set —</option>
            {counties.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Save button */}
      <div className="px-5 py-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  )
}
