'use client'

import { useState, useTransition } from 'react'
import { MapPin } from 'lucide-react'
import { useEffect } from 'react'

type Campus = {
  id: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  schools: { id: string; name: string }[]
}

async function getCampuses(): Promise<Campus[]> {
  const res = await fetch('/api/admin/campuses')
  return res.json()
}

async function saveCampus(campus: Partial<Campus> & { id: string }) {
  await fetch('/api/admin/campuses', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(campus),
  })
}

export default function CampusesPage() {
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ address: '', city: '', state: 'CA', zip: '', phone: '' })
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    getCampuses().then(setCampuses)
  }, [])

  function openEdit(campus: Campus) {
    setEditing(campus.id)
    setForm({
      address: campus.address ?? '',
      city: campus.city ?? '',
      state: campus.state ?? 'CA',
      zip: campus.zip ?? '',
      phone: campus.phone ?? '',
    })
  }

  function handleSave(campusId: string) {
    startTransition(async () => {
      await saveCampus({ id: campusId, ...form })
      setCampuses(prev => prev.map(c => c.id === campusId ? { ...c, ...form } : c))
      setEditing(null)
      setSaved(campusId)
      setTimeout(() => setSaved(null), 2000)
    })
  }

  const addressLine = (c: Campus) =>
    [c.address, c.city, c.state, c.zip].filter(Boolean).join(', ') || 'No address set'

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <MapPin className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campuses</h1>
          <p className="text-gray-500">Manage campus addresses. All schools on a campus share its address.</p>
        </div>
      </div>

      {campuses.length === 0 && (
        <p className="text-sm text-gray-400">No campuses found. Add campuses during onboarding.</p>
      )}

      {campuses.map(campus => (
        <div key={campus.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <span className="font-medium text-gray-900">{addressLine(campus)}</span>
                  {saved === campus.id && <span className="text-xs text-green-600 font-medium">✓ Saved</span>}
                </div>
                {campus.phone && <p className="text-xs text-gray-400 mt-0.5 ml-6">{campus.phone}</p>}
                <div className="ml-6 mt-2 flex flex-wrap gap-1">
                  {campus.schools.map(s => (
                    <span key={s.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s.name}</span>
                  ))}
                </div>
              </div>
              {editing !== campus.id && (
                <button type="button" onClick={() => openEdit(campus)}
                  className="text-xs text-blue-500 hover:text-blue-700 flex-shrink-0">
                  Edit
                </button>
              )}
            </div>

            {editing === campus.id && (
              <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Street address</label>
                    <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="123 Main St"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                    <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                      <input value={form.state} maxLength={2} onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase() }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 uppercase" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Zip</label>
                      <input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Campus phone</label>
                    <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="(555) 555-5555"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleSave(campus.id)} disabled={isPending}
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditing(null)}
                    className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
