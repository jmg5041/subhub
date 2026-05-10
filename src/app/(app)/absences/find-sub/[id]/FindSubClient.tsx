'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Users, CalendarPlus, Briefcase, CheckCircle2 } from 'lucide-react'
import { assignSubDirectly, notifyAllSubsAction, cancelSubAssignment, toggleStaffCoverage } from '../../actions'

type Sub = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  preferredAtSchools: unknown
  priorityRank: number
}

type CombinableAbsence = {
  id: string
  startTime: string
  endTime: string
  firstName: string
  lastName: string
}

type PayBasis = 'exact' | 'half_day' | 'full_day' | 'combine' | 'general_duties'

type Props = {
  timeOffId: string
  subs: Sub[]
  isAlreadyFilled: boolean
  filledByName?: string
  outreachStatus: string
  substituteRequired: boolean
  absenceStartTime: string
  absenceEndTime: string
  schoolDayStart: string
  schoolDayEnd: string
  payModel: 'block' | 'hourly'
  halfDayHours: number
  fullDayHours: number
  combinableAbsences: CombinableAbsence[]
  sameDayPositionCount: number
}

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function fmt(t: string) {
  const [hourStr, min] = t.split(':')
  const h = parseInt(hourStr, 10)
  return `${h % 12 || 12}:${min} ${h >= 12 ? 'PM' : 'AM'}`
}

export default function FindSubClient({
  timeOffId, subs, isAlreadyFilled, filledByName, outreachStatus, substituteRequired,
  absenceStartTime, absenceEndTime, schoolDayStart, schoolDayEnd,
  payModel, halfDayHours, fullDayHours, combinableAbsences, sameDayPositionCount,
}: Props) {
  const router = useRouter()
  const [selectedSubId, setSelectedSubId] = useState('')
  const [search, setSearch] = useState('')
  const [showAssignPanel, setShowAssignPanel] = useState(false)
  const [payBasis, setPayBasis] = useState<PayBasis | null>(null)
  const [selectedCombineIds, setSelectedCombineIds] = useState<string[]>([])
  const [generalDutiesNotes, setGeneralDutiesNotes] = useState('')
  const [isNotifying, startNotifyTransition] = useTransition()
  const [isAssigning, startAssignTransition] = useTransition()
  const [isToggling, startToggleTransition] = useTransition()
  const [result, setResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const isPending = isNotifying || isAssigning || isToggling
  const isStaffCovered = !substituteRequired
  const notifyDisabled = isNotifying || isStaffCovered || !!selectedSubId

  // Partial-day detection
  const absenceMinutes = toMin(absenceEndTime) - toMin(absenceStartTime)
  const schoolDayMinutes = toMin(schoolDayEnd) - toMin(schoolDayStart)
  const absenceHours = absenceMinutes / 60
  const isPartialDay = absenceMinutes < schoolDayMinutes

  const filteredSubs = subs.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase())
  )

  function previewHours(): number {
    if (payBasis === 'half_day') return halfDayHours
    if (payBasis === 'full_day') return fullDayHours
    if (payBasis === 'general_duties') {
      const block = halfDayHours > absenceHours ? halfDayHours : fullDayHours
      return block
    }
    if (payBasis === 'combine') {
      let total = absenceHours
      for (const id of selectedCombineIds) {
        const ca = combinableAbsences.find(c => c.id === id)
        if (ca) total += (toMin(ca.endTime) - toMin(ca.startTime)) / 60
      }
      return total
    }
    return absenceHours
  }

  function handleAssignDirectly() {
    if (!selectedSubId) return
    if (isPartialDay && payModel === 'block' && !payBasis) {
      setResult({ message: 'Please select how to record this sub\'s hours before assigning.', type: 'error' })
      return
    }
    startAssignTransition(async () => {
      const formData = new FormData()
      formData.set('timeOffId', timeOffId)
      formData.set('substituteId', selectedSubId)

      if (payBasis === 'combine') {
        formData.set('payBasis', 'exact')
        if (selectedCombineIds.length > 0) formData.set('additionalTimeOffIds', selectedCombineIds.join(','))
      } else if (payBasis === 'general_duties') {
        const block = halfDayHours > absenceHours ? halfDayHours : fullDayHours
        const remaining = block - absenceHours
        formData.set('payBasis', halfDayHours > absenceHours ? 'half_day' : 'full_day')
        formData.set('generalDutiesHours', remaining.toFixed(2))
        formData.set('generalDutiesNotes', generalDutiesNotes || 'General campus duties')
      } else {
        formData.set('payBasis', payBasis ?? 'exact')
      }

      const res = await assignSubDirectly(formData)
      if (res.success) {
        router.push('/absences/find-sub')
      } else {
        setResult({ message: 'Something went wrong. Please try again.', type: 'error' })
      }
    })
  }

  function handleNotifyAll() {
    const bundleNote = sameDayPositionCount > 1
      ? `\n\n${sameDayPositionCount} open positions on this date will be bundled — each sub receives one notification listing all positions.`
      : ''
    if (!confirm(`Send a notification to all available substitutes? The first to accept will be assigned.${bundleNote}`)) return
    startNotifyTransition(async () => {
      const res = await notifyAllSubsAction(timeOffId)
      if ('sent' in res) {
        const posNote = res.positionCount > 1 ? ` covering ${res.positionCount} open positions` : ''
        setResult({
          message: `Notifications sent to ${res.sent} substitute${res.sent !== 1 ? 's' : ''}${posNote}. The first to accept will be assigned.`,
          type: 'success',
        })
      } else {
        setResult({ message: 'Failed to send notifications. Please try again.', type: 'error' })
      }
    })
  }

  function handleToggleStaff() {
    if (isStaffCovered) {
      if (!confirm('Cancel staff coverage? This absence will need a substitute.')) return
    }
    startToggleTransition(async () => {
      const res = await toggleStaffCoverage(timeOffId, !isStaffCovered)
      if ('success' in res) router.refresh()
      else setResult({ message: 'Failed to update staff coverage.', type: 'error' })
    })
  }

  function handleCancelAssignment() {
    if (!confirm('Cancel this sub assignment? The absence will return to unfilled.')) return
    startAssignTransition(async () => {
      const res = await cancelSubAssignment(timeOffId)
      if ('success' in res) router.refresh()
      else setResult({ message: 'Failed to cancel assignment.', type: 'error' })
    })
  }

  if (isAlreadyFilled) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 space-y-3">
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-semibold">Sub Assigned</span>
        </div>
        {filledByName && (
          <p className="text-sm text-green-700">{filledByName} has been assigned to this absence.</p>
        )}
        <button
          onClick={handleCancelAssignment}
          disabled={isPending}
          className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-50"
        >
          {isPending ? 'Cancelling...' : 'Cancel assignment'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {result && (
        <div className={`rounded-lg border p-4 text-sm ${result.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {result.message}
        </div>
      )}

      {/* Option A: Notify all subs */}
      <div className={`rounded-lg border bg-white p-6 ${notifyDisabled ? 'opacity-60' : 'border-gray-200'}`}>
        <h3 className="font-semibold text-gray-900 mb-1">Notify All Available Substitutes</h3>
        <p className="text-sm text-gray-500 mb-1">
          Sends a notification to the sub pool for this school immediately. If nobody picks it up and the job is still open, the system will re-alert subs at the standard PM/AM alert times.
        </p>
        {isStaffCovered && <p className="text-xs text-blue-600 mb-3">Disabled — this absence is covered by staff.</p>}
        {selectedSubId && !isStaffCovered && <p className="text-xs text-gray-400 mb-3">Disabled — deselect the substitute below to enable.</p>}
        {!isStaffCovered && !selectedSubId && <div className="mb-4" />}
        <button
          onClick={handleNotifyAll}
          disabled={notifyDisabled}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isNotifying ? 'Sending...' : 'Notify Subs Immediately'}
        </button>
      </div>

      <div className="flex items-center gap-3 text-sm text-gray-400">
        <div className="flex-1 border-t border-gray-200" />or<div className="flex-1 border-t border-gray-200" />
      </div>

      {/* Option B: Assign directly */}
      <div className={`rounded-lg border border-gray-200 bg-white p-6 space-y-4 ${isStaffCovered ? 'opacity-60' : ''}`}>
        <div>
          <h3 className="font-semibold text-gray-900 mb-1">Assign a Specific Substitute</h3>
          <p className="text-sm text-gray-500">Pick a sub and assign them directly. No notification will be sent.</p>
        </div>

        {!showAssignPanel ? (
          <button
            onClick={() => !isStaffCovered && setShowAssignPanel(true)}
            disabled={isStaffCovered || isPending}
            className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Choose a Substitute
          </button>
        ) : (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Search substitutes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {filteredSubs.length === 0 ? (
                <p className="p-3 text-sm text-gray-400">No substitutes found.</p>
              ) : (
                filteredSubs.map(sub => (
                  <label
                    key={sub.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 ${selectedSubId === sub.id ? 'bg-blue-50' : ''}`}
                  >
                    <input
                      type="radio"
                      name="sub"
                      value={sub.id}
                      checked={selectedSubId === sub.id}
                      onChange={() => { setSelectedSubId(sub.id); setPayBasis(null) }}
                      className="text-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">
                        {sub.firstName} {sub.lastName}
                        {sub.priorityRank < 999 && (
                          <span className="ml-2 text-xs text-blue-600 font-normal">#{sub.priorityRank} priority</span>
                        )}
                      </div>
                      {sub.email && <div className="text-xs text-gray-400 truncate">{sub.email}</div>}
                    </div>
                  </label>
                ))
              )}
            </div>

            {/* Partial day panel — appears after sub is selected */}
            {selectedSubId && isPartialDay && payModel === 'block' && (
              <PartialDayPanel
                absenceHours={absenceHours}
                halfDayHours={halfDayHours}
                fullDayHours={fullDayHours}
                payBasis={payBasis}
                onPayBasis={setPayBasis}
                combinableAbsences={combinableAbsences}
                selectedCombineIds={selectedCombineIds}
                onToggleCombine={id => setSelectedCombineIds(prev =>
                  prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                )}
                generalDutiesNotes={generalDutiesNotes}
                onGeneralDutiesNotes={setGeneralDutiesNotes}
              />
            )}

            {/* Hours preview */}
            {selectedSubId && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-gray-600">Sub will be credited:</span>
                <span className="font-semibold text-gray-900">{previewHours().toFixed(1)} hours</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleAssignDirectly}
                disabled={!selectedSubId || isPending}
                className="bg-gray-900 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isAssigning ? 'Assigning...' : 'Assign This Sub'}
              </button>
              <button
                onClick={() => { setShowAssignPanel(false); setSelectedSubId(''); setSearch(''); setPayBasis(null) }}
                className="text-gray-500 px-4 py-2.5 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <StaffCoverageToggle isStaffCovered={isStaffCovered} isPending={isToggling} onToggle={handleToggleStaff} />
    </div>
  )
}

function PartialDayPanel({
  absenceHours, halfDayHours, fullDayHours, payBasis, onPayBasis,
  combinableAbsences, selectedCombineIds, onToggleCombine,
  generalDutiesNotes, onGeneralDutiesNotes,
}: {
  absenceHours: number
  halfDayHours: number
  fullDayHours: number
  payBasis: PayBasis | null
  onPayBasis: (b: PayBasis) => void
  combinableAbsences: CombinableAbsence[]
  selectedCombineIds: string[]
  onToggleCombine: (id: string) => void
  generalDutiesNotes: string
  onGeneralDutiesNotes: (n: string) => void
}) {
  const options: { value: PayBasis; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      value: 'exact',
      label: `Exact hours (${absenceHours.toFixed(1)} hrs)`,
      desc: 'Sub is paid only for the absence duration.',
      icon: <Clock className="h-4 w-4 flex-shrink-0" />,
    },
    {
      value: 'half_day',
      label: `Half day (${halfDayHours} hrs)`,
      desc: 'Sub is paid for a half day.',
      icon: <CalendarPlus className="h-4 w-4 flex-shrink-0" />,
    },
    {
      value: 'full_day',
      label: `Full day (${fullDayHours} hrs)`,
      desc: 'Sub is paid for a full school day.',
      icon: <Briefcase className="h-4 w-4 flex-shrink-0" />,
    },
  ]

  if (combinableAbsences.length > 0) {
    options.push({
      value: 'combine',
      label: 'Combine with another absence today',
      desc: `${combinableAbsences.length} other open absence${combinableAbsences.length !== 1 ? 's' : ''} — sub covers both in one shift.`,
      icon: <Users className="h-4 w-4 flex-shrink-0" />,
    })
  }

  options.push({
    value: 'general_duties',
    label: 'Sub handles other duties for remaining time',
    desc: 'Lunchroom, PE yard, front office — sub stays on campus for a half or full day.',
    icon: <Users className="h-4 w-4 flex-shrink-0" />,
  })

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
      <p className="text-sm font-medium text-amber-800">
        This is a {absenceHours.toFixed(1)}-hour absence — not a full school day. How should we record this sub&apos;s time?
      </p>
      <div className="space-y-2">
        {options.map(opt => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
              payBasis === opt.value ? 'border-blue-500 bg-white' : 'border-transparent bg-white/60 hover:bg-white'
            }`}
          >
            <input
              type="radio"
              name="payBasis"
              value={opt.value}
              checked={payBasis === opt.value}
              onChange={() => onPayBasis(opt.value)}
              className="mt-0.5 text-blue-600"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                {opt.icon} {opt.label}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>

      {payBasis === 'combine' && combinableAbsences.length > 0 && (
        <div className="space-y-1 pl-1">
          <p className="text-xs font-medium text-gray-600 mb-1">Select absences to combine into this shift:</p>
          {combinableAbsences.map(ca => (
            <label key={ca.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedCombineIds.includes(ca.id)}
                onChange={() => onToggleCombine(ca.id)}
                className="text-blue-600 rounded"
              />
              <span className="text-gray-800">
                {ca.firstName} {ca.lastName}
                <span className="text-gray-400 ml-1 text-xs">{fmt(ca.startTime)}–{fmt(ca.endTime)}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      {payBasis === 'general_duties' && (
        <div className="pl-1">
          <label className="text-xs font-medium text-gray-600 block mb-1">What duties? (optional)</label>
          <input
            type="text"
            placeholder="e.g. Lunchroom supervision, PE yard duty"
            value={generalDutiesNotes}
            onChange={e => onGeneralDutiesNotes(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  )
}

function StaffCoverageToggle({ isStaffCovered, isPending, onToggle }: {
  isStaffCovered: boolean
  isPending: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900">Covered by Staff</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {isStaffCovered
              ? 'This absence is being handled by admin or staff — no sub needed.'
              : 'Toggle on if admin or staff will cover this absence instead of a substitute.'}
          </p>
        </div>
        <button
          onClick={onToggle}
          disabled={isPending}
          aria-pressed={isStaffCovered}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
            isStaffCovered ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${isStaffCovered ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
    </div>
  )
}
