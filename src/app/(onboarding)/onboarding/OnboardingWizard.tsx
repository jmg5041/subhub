'use client'

import { useState, useTransition } from 'react'
import {
  Building2, MapPin, CheckCircle, CreditCard,
  ChevronLeft, ChevronRight, Search, X, Loader2, AlertCircle, Tag, Gift, Mail, HelpCircle, Plus,
} from 'lucide-react'
import {
  saveOrgBasics,
  searchOrgDirectory,
  addCampus,
  addSchoolToCampus,
  removeCampus,
  removeOnboardingSchool,
  submitDiscountRequest,
  completeOnboarding,
} from './actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type OrgData = {
  timezone: string | null
  subPayModel: string | null
  halfDayHours: string | null
  fullDayHours: string | null
  autoNotifySubs: boolean | null
  notifyByEmail: boolean | null
  notifyBySms: boolean | null
  notifyByPhone: boolean | null
  districtName: string | null
}

type SchoolEntry = { id: string; name: string }

type CampusEntry = {
  id: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  schools: SchoolEntry[]
}

type DirectoryResult = {
  id: string
  schoolName: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  county: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { number: 1, label: 'School Info', icon: Building2   },
  { number: 2, label: 'Campuses',    icon: MapPin      },
  { number: 3, label: 'Billing',     icon: CreditCard  },
  { number: 4, label: 'Finish',      icon: CheckCircle },
]

const TIMEZONES = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)'              },
  { value: 'America/Denver',      label: 'Mountain Time (MT)'             },
  { value: 'America/Phoenix',     label: 'Arizona Time (no DST)'          },
  { value: 'America/Chicago',     label: 'Central Time (CT)'              },
  { value: 'America/New_York',    label: 'Eastern Time (ET)'              },
  { value: 'America/Anchorage',   label: 'Alaska Time (AKT)'              },
  { value: 'Pacific/Honolulu',    label: 'Hawaii Time (HST)'              },
]

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8 flex items-center justify-between">
      {STEPS.map((step, index) => {
        const Icon = step.icon
        const done = currentStep > step.number
        const active = currentStep === step.number
        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                done   ? 'border-blue-600 bg-blue-600 text-white' :
                active ? 'border-blue-600 bg-white text-blue-600' :
                         'border-gray-300 bg-white text-gray-400'
              }`}>
                {done ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <span className={`mt-1 text-xs font-medium ${active || done ? 'text-blue-600' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`mx-2 h-0.5 w-8 flex-shrink-0 transition-colors ${
                currentStep > step.number ? 'bg-blue-600' : 'bg-gray-200'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Org Basics ───────────────────────────────────────────────────────

function Step1OrgBasics({ org, onSaved }: { org: OrgData; onSaved: () => void }) {
  const [districtName,  setDistrictName]  = useState(org.districtName  ?? '')
  const [timezone,      setTimezone]      = useState(org.timezone      ?? 'America/Los_Angeles')
  const [subPayModel,   setSubPayModel]   = useState(org.subPayModel   ?? 'block')
  const [halfDayHours,  setHalfDayHours]  = useState(org.halfDayHours  ?? '4.0')
  const [fullDayHours,  setFullDayHours]  = useState(org.fullDayHours  ?? '8.0')
  const [autoNotify,    setAutoNotify]    = useState(org.autoNotifySubs ?? true)
  const [byEmail,       setByEmail]       = useState(org.notifyByEmail  ?? true)
  const [bySms,         setBySms]         = useState(org.notifyBySms    ?? true)
  const [byPhone,       setByPhone]       = useState(org.notifyByPhone  ?? false)
  const [isPending,     startTransition]  = useTransition()
  const [error,         setError]         = useState<string | null>(null)

  function handleNext() {
    setError(null)
    startTransition(async () => {
      try {
        await saveOrgBasics({
          timezone, subPayModel,
          halfDayHours: parseFloat(halfDayHours).toFixed(1),
          fullDayHours: parseFloat(fullDayHours).toFixed(1),
          autoNotifySubs: autoNotify,
          notifyByEmail: byEmail,
          notifyBySms: bySms,
          notifyByPhone: byPhone,
          districtName: districtName.trim() || undefined,
        })
        onSaved()
      } catch {
        setError('Failed to save. Please try again.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Tell us about your school</h2>
        <p className="text-sm text-gray-500">These settings control how SubHub notifies substitutes.</p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">
          District name <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input type="text" value={districtName} onChange={(e) => setDistrictName(e.target.value)}
          placeholder="e.g. Southlands Christian Schools, ABC Unified School District"
          className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        <p className="text-xs text-gray-400">The umbrella district or organization name. Leave blank to use your school name.</p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-800">Set your timezone first</p>
        <p className="mt-0.5 text-xs text-amber-700">
          All substitute notification timing depends on this. Pick the wrong timezone and your subs get called at 3 AM.
        </p>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="mt-3 h-10 w-full rounded-md border border-amber-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Substitute Pay Model</label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'block',  label: 'Block Rate',  desc: 'Half-day / full-day flat rate' },
            { value: 'hourly', label: 'Hourly Rate',  desc: 'Pay per hour worked' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSubPayModel(opt.value)}
              className={`rounded-lg border-2 p-3 text-left transition-colors ${
                subPayModel === opt.value
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className={`text-sm font-medium ${subPayModel === opt.value ? 'text-blue-700' : 'text-gray-900'}`}>
                {opt.label}
              </p>
              <p className="text-xs text-gray-500">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Half-day hours</label>
          <input type="number" min="1" max="8" step="0.5" value={halfDayHours}
            onChange={(e) => setHalfDayHours(e.target.value)}
            className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Full-day hours</label>
          <input type="number" min="1" max="12" step="0.5" value={fullDayHours}
            onChange={(e) => setFullDayHours(e.target.value)}
            className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">How to notify substitutes</label>
        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          {[
            { id: 'autoNotify', label: 'Auto-notify when absence is approved', value: autoNotify, set: setAutoNotify },
            { id: 'byEmail',    label: 'Email',                                value: byEmail,    set: setByEmail    },
            { id: 'bySms',      label: 'Text message (SMS)',                   value: bySms,      set: setBySms      },
            { id: 'byPhone',    label: 'Phone call (IVR)',                     value: byPhone,    set: setByPhone    },
          ].map((item) => (
            <label key={item.id} className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={item.value} onChange={(e) => item.set(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600" />
              <span className="text-sm text-gray-700">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button type="button" onClick={handleNext} disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Campuses & Schools ───────────────────────────────────────────────

function CampusCard({
  campus,
  onRemoveCampus,
  onAddSchool,
  onRemoveSchool,
  isPending,
}: {
  campus: CampusEntry
  onRemoveCampus: (id: string) => void
  onAddSchool: (campusId: string, name: string) => void
  onRemoveSchool: (campusId: string, schoolId: string) => void
  isPending: boolean
}) {
  const [schoolInput, setSchoolInput] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  const addressLine = [campus.address, campus.city, campus.state, campus.zip].filter(Boolean).join(', ')

  function handleAddSchool() {
    if (!schoolInput.trim()) return
    onAddSchool(campus.id, schoolInput.trim())
    setSchoolInput('')
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Campus header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <p className="text-sm font-medium text-gray-900">{addressLine || 'Campus'}</p>
        </div>
        <button type="button" onClick={() => onRemoveCampus(campus.id)} disabled={isPending}
          className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-40">
          Remove campus
        </button>
      </div>

      {/* Schools section */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Schools on this campus</p>
          <button type="button" onClick={() => setShowHelp(v => !v)}
            className="text-gray-300 hover:text-gray-500">
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>

        {showHelp && (
          <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800">
            Many schools share a campus — elementary, middle, and high school may all be on the same address.
            Naming each school separately lets you control which substitutes serve which grade levels.
          </div>
        )}

        {campus.schools.map(school => (
          <div key={school.id} className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-sm text-gray-800">{school.name}</p>
            <button type="button" onClick={() => onRemoveSchool(campus.id, school.id)} disabled={isPending}
              className="text-gray-300 hover:text-red-400 disabled:opacity-40">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {/* Add school inline */}
        <div className="flex gap-2 pt-1">
          <input
            type="text"
            value={schoolInput}
            onChange={e => setSchoolInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddSchool()}
            placeholder="e.g. Northside Elementary, Upper School"
            className="flex-1 h-9 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <button type="button" onClick={handleAddSchool} disabled={!schoolInput.trim() || isPending}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>

        {campus.schools.length === 0 && (
          <p className="text-xs text-amber-600">Add at least one school to this campus.</p>
        )}
      </div>
    </div>
  )
}

function Step2Campuses({
  initialCampuses,
  onBack,
  onNext,
}: {
  initialCampuses: CampusEntry[]
  onBack: () => void
  onNext: () => void
}) {
  const [campusList, setCampusList]   = useState<CampusEntry[]>(initialCampuses)
  const [showEntry, setShowEntry]     = useState(initialCampuses.length === 0)
  const [entryMode, setEntryMode]     = useState<'search' | 'manual'>('search')
  const [query, setQuery]             = useState('')
  const [searchResults, setSearchResults] = useState<DirectoryResult[]>([])
  const [manualForm, setManualForm]   = useState({ address: '', city: '', state: 'CA', zip: '', phone: '' })
  const [isPending, startTransition]  = useTransition()

  const canContinue = campusList.length > 0 && campusList.every(c => c.schools.length > 0)

  function handleSearch() {
    if (query.trim().length < 2) return
    startTransition(async () => {
      const rows = await searchOrgDirectory(query)
      setSearchResults(rows as DirectoryResult[])
    })
  }

  function handleAddFromSearch(result: DirectoryResult) {
    startTransition(async () => {
      const { campus } = await addCampus({
        address: result.address ?? undefined,
        city: result.city ?? undefined,
        state: result.state ?? 'CA',
        zip: result.zip ?? undefined,
        phone: result.phone ?? undefined,
      })
      setCampusList(prev => [...prev, { ...campus, schools: [] }])
      setSearchResults([])
      setQuery('')
      setShowEntry(false)
    })
  }

  function handleAddManual() {
    if (!manualForm.address.trim() && !manualForm.city.trim()) return
    startTransition(async () => {
      const { campus } = await addCampus(manualForm)
      setCampusList(prev => [...prev, { ...campus, schools: [] }])
      setManualForm({ address: '', city: '', state: 'CA', zip: '', phone: '' })
      setShowEntry(false)
    })
  }

  function handleRemoveCampus(campusId: string) {
    startTransition(async () => {
      await removeCampus(campusId)
      setCampusList(prev => prev.filter(c => c.id !== campusId))
      if (campusList.length === 1) setShowEntry(true)
    })
  }

  function handleAddSchool(campusId: string, name: string) {
    startTransition(async () => {
      const { school } = await addSchoolToCampus({ campusId, name })
      setCampusList(prev => prev.map(c =>
        c.id === campusId ? { ...c, schools: [...c.schools, { id: school.id, name: school.name }] } : c
      ))
    })
  }

  function handleRemoveSchool(campusId: string, schoolId: string) {
    startTransition(async () => {
      await removeOnboardingSchool(schoolId)
      setCampusList(prev => prev.map(c =>
        c.id === campusId ? { ...c, schools: c.schools.filter(s => s.id !== schoolId) } : c
      ))
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Campuses &amp; Schools</h2>
        <p className="text-sm text-gray-500">
          Enter each physical campus location, then add the schools that meet on it.
          Single-campus schools just need one entry.
        </p>
      </div>

      {/* Existing campuses */}
      {campusList.map(campus => (
        <CampusCard key={campus.id} campus={campus}
          onRemoveCampus={handleRemoveCampus}
          onAddSchool={handleAddSchool}
          onRemoveSchool={handleRemoveSchool}
          isPending={isPending}
        />
      ))}

      {/* Campus entry panel */}
      {showEntry && (
        <div className="rounded-lg border-2 border-dashed border-blue-200 bg-blue-50 p-4 space-y-4">
          <p className="text-sm font-medium text-gray-700">
            {campusList.length === 0 ? 'Enter your campus address' : 'Add another campus'}
          </p>

          {/* Search / Manual toggle */}
          <div className="flex gap-1 rounded-lg bg-white border border-gray-200 p-0.5 w-fit">
            {(['search', 'manual'] as const).map(mode => (
              <button key={mode} type="button" onClick={() => { setEntryMode(mode); setSearchResults([]) }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  entryMode === mode ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {mode === 'search' ? 'Search CA directory' : 'Enter manually'}
              </button>
            ))}
          </div>

          {entryMode === 'search' ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by school name or city…"
                  className="flex-1 h-9 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500" />
                <button type="button" onClick={handleSearch} disabled={isPending || query.trim().length < 2}
                  className="flex items-center gap-1 rounded-md bg-white border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  <Search className="h-3.5 w-3.5" /> Search
                </button>
              </div>
              <p className="text-xs text-gray-400 italic">
                Select a result to use its address as your campus. The school name from the directory is not used — you'll add school names below.
              </p>
              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white divide-y divide-gray-100">
                  {searchResults.map(r => (
                    <button key={r.id} type="button" onClick={() => handleAddFromSearch(r)}
                      disabled={isPending}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-blue-50 disabled:opacity-40 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{r.schoolName}</p>
                        <p className="text-xs text-gray-400">{[r.address, r.city, r.county + ' Co.'].filter(Boolean).join(' · ')}</p>
                      </div>
                      <span className="text-xs text-blue-600 font-medium ml-3 flex-shrink-0">Use address →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <input type="text" placeholder="Street address"
                value={manualForm.address} onChange={e => setManualForm(f => ({ ...f, address: e.target.value }))}
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500" />
              <div className="grid grid-cols-3 gap-2">
                <input type="text" placeholder="City" value={manualForm.city}
                  onChange={e => setManualForm(f => ({ ...f, city: e.target.value }))}
                  className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500" />
                <input type="text" placeholder="State" maxLength={2} value={manualForm.state}
                  onChange={e => setManualForm(f => ({ ...f, state: e.target.value.toUpperCase() }))}
                  className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 uppercase" />
                <input type="text" placeholder="Zip" value={manualForm.zip}
                  onChange={e => setManualForm(f => ({ ...f, zip: e.target.value }))}
                  className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500" />
              </div>
              <button type="button" onClick={handleAddManual}
                disabled={isPending || (!manualForm.address.trim() && !manualForm.city.trim())}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add this campus
              </button>
            </div>
          )}

          {campusList.length > 0 && (
            <button type="button" onClick={() => setShowEntry(false)}
              className="text-xs text-gray-400 hover:text-gray-600">
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Add another campus button */}
      {!showEntry && campusList.length > 0 && (
        <button type="button" onClick={() => setShowEntry(true)}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
          <Plus className="h-4 w-4" /> Add another campus
        </button>
      )}

      {campusList.length === 0 && !showEntry && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">Add at least one campus to continue.</p>
        </div>
      )}

      <div className="flex justify-between">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button type="button" onClick={onNext} disabled={!canContinue || isPending}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Billing ──────────────────────────────────────────────────────────

function Step3Billing({
  alreadySetUp,
  pricePerSeatCents,
  initialSeatCount,
  onBack,
  onNext,
}: {
  alreadySetUp: boolean
  pricePerSeatCents: number
  initialSeatCount: number | null
  onBack: () => void
  onNext: () => void
}) {
  const [seats, setSeats]           = useState(initialSeatCount ?? 1)
  const [showBillForm, setShowBillForm] = useState(false)
  const [isPending, startTransition] = useTransition()

  const pricePerSeat = pricePerSeatCents / 100
  const monthly = seats * pricePerSeat

  if (alreadySetUp) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Billing</h2>
          <p className="text-sm text-gray-500">Your billing is already configured.</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 px-5 py-4">
          <p className="font-semibold text-green-800">✓ Billing set up</p>
          <p className="text-sm text-green-700 mt-1">You can manage billing details from the Billing page after setup.</p>
        </div>
        <div className="flex justify-between">
          <button type="button" onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <button type="button" onClick={onNext}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">How many teacher seats do you need?</h2>
        <p className="text-sm text-gray-500">You can adjust this any time from the Billing page.</p>
      </div>

      {/* Seat count + live price */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="number" min="1" value={seats}
            onChange={(e) => setSeats(Math.max(parseInt(e.target.value) || 1, 1))}
            className="w-24 h-10 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <span className="text-sm text-gray-600">teachers</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-gray-900">${monthly.toFixed(2)}</span>
          <span className="text-sm text-gray-500">/month</span>
          <span className="text-xs text-gray-400 ml-1">({seats} × ${pricePerSeat.toFixed(2)}/seat)</span>
        </div>
      </div>

      {/* Discount options */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-800">Want to save money?</p>

        {/* Option A — Send your bill */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <button type="button" onClick={() => setShowBillForm(v => !v)}
            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
            <Mail className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-800">Send us your current sub software bill</p>
              <p className="text-xs text-gray-500 mt-0.5">
                We&apos;ll give you the steepest discount we can — up to 50% off your current bill.
              </p>
            </div>
          </button>

          {showBillForm && (
            <form action={submitDiscountRequest} className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              <input type="hidden" name="option" value="bill" />
              <input type="hidden" name="seatCount" value={seats} />
              <div>
                <label className="block text-xs text-gray-600 mb-1">Current software name <span className="text-gray-400">(optional)</span></label>
                <input type="text" name="software" placeholder="e.g. Frontline / Aesop"
                  className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Your annual cost <span className="text-gray-400">(optional)</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <input type="number" name="annualCost" placeholder="4700" min="0"
                    className="w-full h-9 rounded-md border border-gray-300 pl-6 pr-3 text-sm outline-none focus:border-blue-500" />
                </div>
              </div>
              <button type="submit" disabled={isPending}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Send request — we&apos;ll be in touch within 24 hours
              </button>
            </form>
          )}
        </div>

        {/* Option B — Request 25% off */}
        <form action={submitDiscountRequest}>
          <input type="hidden" name="option" value="discount25" />
          <input type="hidden" name="seatCount" value={seats} />
          <button type="submit" disabled={isPending}
            className="w-full flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left hover:bg-gray-50 transition-colors disabled:opacity-50">
            <Tag className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-800">Request 25% off — no bill needed</p>
              <p className="text-xs text-gray-500 mt-0.5">
                We&apos;ll send you a promo code. Start using SubHub today while we get it to you.
              </p>
            </div>
          </button>
        </form>

        {/* Option C — 3 months free */}
        <form action="/api/stripe/checkout" method="POST">
          <input type="hidden" name="returnTo" value="onboarding" />
          <input type="hidden" name="seatCount" value={seats} />
          <input type="hidden" name="trialDays" value="90" />
          <button type="submit"
            className="w-full flex items-start gap-3 rounded-lg border-2 border-blue-600 bg-blue-50 px-4 py-3 text-left hover:bg-blue-100 transition-colors">
            <Gift className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-700">Get 3 months free — only pay if it works</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Enter your card now, get 90 days free. Cancel any time before then and you&apos;ll never be charged.
              </p>
            </div>
          </button>
        </form>
      </div>

      <div className="flex justify-between items-center">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button type="button" onClick={onNext}
          className="text-sm text-gray-400 hover:text-gray-600 hover:underline">
          Skip for now
        </button>
      </div>
    </div>
  )
}

// ─── Step 4: Finish ───────────────────────────────────────────────────────────

function Step4Finish({ onBack }: { onBack: () => void }) {
  const [isPending, startTransition] = useTransition()

  function handleFinish() {
    startTransition(async () => {
      await completeOnboarding()
    })
  }

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <CheckCircle className="h-8 w-8 text-green-600" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-gray-900">You&apos;re all set!</h2>
        <p className="mt-1 text-sm text-gray-500">
          Your school is configured. You can add teachers and substitutes any time from the dashboard.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <button type="button" onClick={handleFinish} disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-8 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          Go to Dashboard
        </button>
        <button type="button" onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">
          Back
        </button>
      </div>
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function OnboardingWizard({
  org,
  orgId,
  initialCampuses,
  startStep,
  billingAlreadySetUp,
  pricePerSeatCents,
  initialSeatCount,
}: {
  org: OrgData
  orgId: string
  initialCampuses: CampusEntry[]
  startStep: number
  billingAlreadySetUp: boolean
  pricePerSeatCents: number
  initialSeatCount: number | null
}) {
  const [step, setStep] = useState(startStep)

  return (
    <div className="mx-auto max-w-2xl">
      <StepIndicator currentStep={step} />
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {step === 1 && <Step1OrgBasics org={org} onSaved={() => setStep(2)} />}
        {step === 2 && (
          <Step2Campuses
            initialCampuses={initialCampuses}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <Step3Billing
            alreadySetUp={billingAlreadySetUp}
            pricePerSeatCents={pricePerSeatCents}
            initialSeatCount={initialSeatCount}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && <Step4Finish onBack={() => setStep(3)} />}
      </div>
    </div>
  )
}
