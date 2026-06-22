'use client'

import { useState, useTransition, useEffect } from 'react'
import { MapPin, Plus } from 'lucide-react'

type Campus = {
  id: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  schools: { id: string; name: string }[]
}

type OrgInfo = {
  name: string
  districtName: string | null
  campuses: Campus[]
}

export default function CampusesPage() {
  const [info, setInfo]             = useState<OrgInfo | null>(null)
  const [editing, setEditing]       = useState<string | null>(null)
  const [editForm, setEditForm]     = useState({ address: '', city: '', state: 'CA', zip: '', phone: '' })
  const [showAdd, setShowAdd]       = useState(false)
  const [addForm, setAddForm]       = useState({ address: '', city: '', state: 'CA', zip: '', phone: '' })
  const [isPending, startTransition] = useTransition()
  const [savedId, setSavedId]       = useState<string | null>(null)
  const [addError, setAddError]     = useState('')

  useEffect(() => {
    fetch('/api/admin/campuses/info').then(r => r.json()).then(setInfo)
  }, [])

  function openEdit(campus: Campus) {
    setEditing(campus.id)
    setEditForm({ address: campus.address ?? '', city: campus.city ?? '', state: campus.state ?? 'CA', zip: campus.zip ?? '', phone: campus.phone ?? '' })
  }

  function handleSave(campusId: string) {
    startTransition(async () => {
      await fetch('/api/admin/campuses', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: campusId, ...editForm }) })
      setInfo(prev => prev ? { ...prev, campuses: prev.campuses.map(c => c.id === campusId ? { ...c, ...editForm } : c) } : prev)
      setEditing(null)
      setSavedId(campusId)
      setTimeout(() => setSavedId(null), 2000)
    })
  }

  function handleAdd() {
    if (!addForm.address.trim() && !addForm.city.trim()) { setAddError('Enter at least a street address or city.'); return }
    setAddError('')
    startTransition(async () => {
      const res = await fetch('/api/admin/campuses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addForm) })
      const { campus } = await res.json()
      setInfo(prev => prev ? { ...prev, campuses: [...prev.campuses, { ...campus, schools: [] }] } : prev)
      setShowAdd(false)
      setAddForm({ address: '', city: '', state: 'CA', zip: '', phone: '' })
    })
  }

  const addressLine = (c: Campus) => [c.address, c.city, c.state, c.zip].filter(Boolean).join(', ') || 'No address set'

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500'

  function AddressForm({ form, setForm, onSave, onCancel, saveLabel }: {
    form: typeof addForm
    setForm: (f: typeof addForm) => void
    onSave: () => void
    onCancel: () => void
    saveLabel: string
  }) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Street address</label>
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="123 Main St" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
            <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
              <input value={form.state} maxLength={2} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase() })} className={inputCls + ' uppercase'} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Zip</label>
              <input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Campus phone <span className="text-gray-400">(optional)</span></label>
            <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(555) 555-5555" className={inputCls} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onSave} disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
            {isPending ? 'Saving…' : saveLabel}
          </button>
          <button type="button" onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (!info) return <div className="text-sm text-gray-400 p-8">Loading…</div>

  const displayName = info.districtName || info.name

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <MapPin className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campuses</h1>
          <p className="text-gray-500">
            District: <span className="font-medium text-gray-700">{displayName}</span>
            {' · '}All schools on a campus share its physical address.
            {' '}To update the district name go to <a href="/settings" className="text-blue-600 hover:underline">Settings → Organization</a>.
          </p>
        </div>
      </div>

      {info.campuses.map(campus => (
        <div key={campus.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <span className="font-medium text-gray-900">{addressLine(campus)}</span>
                  {savedId === campus.id && <span className="text-xs text-green-600 font-medium">✓ Saved</span>}
                </div>
                {campus.phone && <p className="text-xs text-gray-400 mt-0.5 ml-6">{campus.phone}</p>}
                <div className="ml-6 mt-2 flex flex-wrap gap-1">
                  {campus.schools.length > 0
                    ? campus.schools.map(s => <span key={s.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s.name}</span>)
                    : <span className="text-xs text-amber-600">No schools assigned yet — add from Admin → Schools</span>}
                </div>
              </div>
              {editing !== campus.id && (
                <button type="button" onClick={() => openEdit(campus)} className="text-xs text-blue-500 hover:text-blue-700 flex-shrink-0 ml-3">Edit</button>
              )}
            </div>

            {editing === campus.id && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <AddressForm form={editForm} setForm={setEditForm} onSave={() => handleSave(campus.id)} onCancel={() => setEditing(null)} saveLabel="Save" />
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add campus */}
      {!showAdd ? (
        <button type="button" onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
          <Plus className="h-4 w-4" /> Add another campus
        </button>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-blue-200 bg-blue-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">Add a campus</p>
          <p className="text-xs text-gray-500">Enter the physical address. After adding, go to Admin → Schools to add the schools that meet here.</p>
          {addError && <p className="text-xs text-red-600">{addError}</p>}
          <AddressForm form={addForm} setForm={setAddForm} onSave={handleAdd} onCancel={() => { setShowAdd(false); setAddError('') }} saveLabel="Add campus" />
        </div>
      )}
    </div>
  )
}
