'use client'

import { useState, useTransition } from 'react'
import {
  Building2, MapPin, CheckCircle,
  ChevronLeft, ChevronRight, Search, Plus, X, Loader2, AlertCircle,
} from 'lucide-react'
import {
  saveOrgBasics,
  searchOrgDirectory,
  addSchoolFromDirectory,
  addSchoolManually,
  removeOnboardingSchool,
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
}

type School = {
  id: string
  name: string
  city: string | null
  county: string | null
  dayStartTime: string | null
  dayEndTime: string | null
}

type DirectoryEntry = {
  id: string
  schoolName: string
  city: string | null
  county: string
  address: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { number: 1, label: 'School Info', icon: Building2   },
  { number: 2, label: 'Campuses',    icon: MapPin      },
  { number: 3, label: 'Finish',      icon: CheckCircle },
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
              <div className={`mx-2 h-0.5 w-12 flex-shrink-0 transition-colors ${
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

function Step1OrgBasics({
  org,
  onSaved,
}: {
  org: OrgData
  onSaved: () => void
}) {
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

      {/* Timezone — first and most important */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-800">Set your timezone first</p>
        <p className="mt-0.5 text-xs text-amber-700">
          All substitute notification timing (morning blasts, evening alerts) depends on this.
          Pick the wrong timezone and your subs get called at 3 AM.
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

      {/* Pay model */}
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

      {/* Hours */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Half-day hours</label>
          <input
            type="number"
            min="1" max="8" step="0.5"
            value={halfDayHours}
            onChange={(e) => setHalfDayHours(e.target.value)}
            className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Full-day hours</label>
          <input
            type="number"
            min="1" max="12" step="0.5"
            value={fullDayHours}
            onChange={(e) => setFullDayHours(e.target.value)}
            className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Notification channels */}
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
              <input
                type="checkbox"
                checked={item.value}
                onChange={(e) => item.set(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleNext}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Schools / Campuses ───────────────────────────────────────────────

function Step2Schools({
  orgId,
  initialSchools,
  onBack,
  onNext,
}: {
  orgId: string
  initialSchools: School[]
  onBack: () => void
  onNext: () => void
}) {
  const [schools, setSchools]             = useState<School[]>(initialSchools)
  const [query, setQuery]                 = useState('')
  const [results, setResults]             = useState<DirectoryEntry[]>([])
  const [showManual, setShowManual]       = useState(false)
  const [manualName, setManualName]       = useState('')
  const [manualStart, setManualStart]     = useState('08:00')
  const [manualEnd, setManualEnd]         = useState('15:30')
  const [isPending, startTransition]      = useTransition()
  const [error, setError]                 = useState<string | null>(null)

  function handleSearch() {
    if (query.trim().length < 2) return
    startTransition(async () => {
      const rows = await searchOrgDirectory(query)
      setResults(rows as DirectoryEntry[])
    })
  }

  function handleAddFromDirectory(entry: DirectoryEntry) {
    startTransition(async () => {
      const result = await addSchoolFromDirectory(entry.id)
      if ('error' in result) { setError(result.error ?? 'Unknown error'); return }
      setSchools((prev) => [...prev, result.school as School])
      setResults((prev) => prev.filter((r) => r.id !== entry.id))
    })
  }

  function handleAddManually() {
    if (!manualName.trim()) return
    startTransition(async () => {
      const result = await addSchoolManually({
        name: manualName.trim(),
        dayStartTime: manualStart,
        dayEndTime: manualEnd,
      })
      setSchools((prev) => [...prev, result.school as School])
      setManualName('')
      setShowManual(false)
    })
  }

  function handleRemove(schoolId: string) {
    startTransition(async () => {
      await removeOnboardingSchool(schoolId)
      setSchools((prev) => prev.filter((s) => s.id !== schoolId))
    })
  }

  function formatTime(t: string | null) {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Add your campuses</h2>
        <p className="text-sm text-gray-500">
          Search the California school directory or enter your campuses manually.
        </p>
      </div>

      {/* Directory search */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search by school or district name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1 h-10 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={isPending || query.trim().length < 2}
          className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          Search
        </button>
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
          {results.map((entry) => {
            const alreadyAdded = schools.some((s) => s.name === entry.schoolName)
            return (
              <div key={entry.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{entry.schoolName}</p>
                  <p className="text-xs text-gray-500">{entry.city}, {entry.county} County</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddFromDirectory(entry)}
                  disabled={isPending || alreadyAdded}
                  className="flex items-center gap-1 rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                >
                  {alreadyAdded ? 'Added' : <><Plus className="h-3 w-3" /> Add</>}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Manual entry toggle */}
      {!showManual ? (
        <button
          type="button"
          onClick={() => setShowManual(true)}
          className="text-sm text-blue-600 hover:underline"
        >
          + Enter campus manually
        </button>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Manual entry</p>
          <input
            type="text"
            placeholder="Campus name"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-600">Day start time</label>
              <input type="time" value={manualStart} onChange={(e) => setManualStart(e.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-600">Day end time</label>
              <input type="time" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAddManually} disabled={!manualName.trim() || isPending}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
              Add campus
            </button>
            <button type="button" onClick={() => setShowManual(false)}
              className="rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Added schools list */}
      {schools.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Your campuses ({schools.length})</p>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {schools.map((school) => (
              <div key={school.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{school.name}</p>
                  <p className="text-xs text-gray-500">
                    {school.city ? `${school.city} · ` : ''}
                    {formatTime(school.dayStartTime)} – {formatTime(school.dayEndTime)}
                  </p>
                </div>
                <button type="button" onClick={() => handleRemove(school.id)} disabled={isPending}
                  className="rounded-md p-1 text-gray-400 hover:text-red-500 disabled:opacity-40">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {schools.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">Add at least one campus before continuing.</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-between">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button type="button" onClick={onNext} disabled={schools.length === 0 || isPending}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Finish ───────────────────────────────────────────────────────────

function Step3Finish({ onBack }: { onBack: () => void }) {
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
        <button
          type="button"
          onClick={handleFinish}
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-8 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
        >
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
  initialSchools,
  startStep,
}: {
  org: OrgData
  orgId: string
  initialSchools: School[]
  startStep: number
}) {
  const [step, setStep] = useState(startStep)

  return (
    <div className="mx-auto max-w-2xl">
      <StepIndicator currentStep={step} />
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {step === 1 && (
          <Step1OrgBasics org={org} onSaved={() => setStep(2)} />
        )}
        {step === 2 && (
          <Step2Schools
            orgId={orgId}
            initialSchools={initialSchools}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <Step3Finish onBack={() => setStep(2)} />
        )}
      </div>
    </div>
  )
}
