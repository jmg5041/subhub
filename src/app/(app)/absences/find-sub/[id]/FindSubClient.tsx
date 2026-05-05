'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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

type Props = {
  timeOffId: string
  subs: Sub[]
  isAlreadyFilled: boolean
  filledByName?: string
  outreachStatus: string
  substituteRequired: boolean
}

export default function FindSubClient({ timeOffId, subs, isAlreadyFilled, filledByName, outreachStatus, substituteRequired }: Props) {
  const router = useRouter()
  const [selectedSubId, setSelectedSubId] = useState('')
  const [search, setSearch] = useState('')
  const [showAssignPanel, setShowAssignPanel] = useState(false)
  const [isNotifying, startNotifyTransition] = useTransition()
  const [isAssigning, startAssignTransition] = useTransition()
  const [isToggling, startToggleTransition] = useTransition()
  const [isCancelling, startCancelTransition] = useTransition()
  const [result, setResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const isPending = isNotifying || isAssigning || isToggling || isCancelling
  const isStaffCovered = !substituteRequired
  const notifyDisabled = isNotifying || isStaffCovered || !!selectedSubId

  const filteredSubs = subs.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase())
  )

  function handleAssignDirectly() {
    if (!selectedSubId) return
    const sub = subs.find(s => s.id === selectedSubId)
    if (!confirm(`Assign ${sub?.firstName} ${sub?.lastName} to this absence? No notification will be sent.`)) return

    startAssignTransition(async () => {
      const formData = new FormData()
      formData.set('timeOffId', timeOffId)
      formData.set('substituteId', selectedSubId)
      const res = await assignSubDirectly(formData)
      if (res.success) {
        router.push('/absences/find-sub')
      } else {
        setResult({ message: 'Something went wrong. Please try again.', type: 'error' })
      }
    })
  }

  function handleNotifyAll() {
    if (!confirm('Send a notification to all available substitutes? The first to accept will be assigned.')) return

    startNotifyTransition(async () => {
      const res = await notifyAllSubsAction(timeOffId)
      if ('sent' in res) {
        setResult({
          message: `Notifications sent to ${res.sent} substitute${res.sent !== 1 ? 's' : ''}. They will receive a message with accept/decline links.`,
          type: 'success',
        })
      } else {
        setResult({ message: 'Failed to send notifications. Please try again.', type: 'error' })
      }
    })
  }

  function handleToggleStaff() {
    if (isStaffCovered) {
      // Turning OFF — warn the admin
      if (!confirm(
        'Are you sure you want to cancel staff coverage?\n\n' +
        'This absence will need a substitute unless you manually assign one or notify all subs.'
      )) return
    }

    startToggleTransition(async () => {
      const res = await toggleStaffCoverage(timeOffId, !isStaffCovered)
      if ('success' in res) {
        router.refresh()
      } else {
        setResult({ message: 'Failed to update staff coverage. Please try again.', type: 'error' })
      }
    })
  }

  // Sub is assigned — show filled panel with cancel option
  if (isAlreadyFilled) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 space-y-4">
          <div>
            <div className="text-xl font-semibold text-green-700 mb-1">Position Filled</div>
            {filledByName && <p className="text-green-600">Covered by {filledByName}</p>}
          </div>
          <div className="border-t border-green-200 pt-4">
            <p className="text-sm text-gray-600 mb-3">Need to make a change? You can cancel this assignment and start over.</p>
            <button
              disabled={isPending}
              onClick={() => {
                if (!confirm('Cancel this sub assignment? The absence will go back to needing a sub.')) return
                startCancelTransition(async () => {
                  const res = await cancelSubAssignment(timeOffId)
                  if ('success' in res) router.push(`/absences/find-sub/${timeOffId}`)
                  else setResult({ message: 'Failed to cancel assignment.', type: 'error' })
                })
              }}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel Assignment'}
            </button>
            {result && <p className="mt-2 text-sm text-red-600">{result.message}</p>}
          </div>
        </div>
      </div>
    )
  }

  if (outreachStatus === 'sent' && !result) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <div className="text-lg font-semibold text-blue-700 mb-1">Notifications Sent</div>
          <p className="text-blue-600 text-sm">Substitutes have been notified. The first to accept will be assigned. This page will update when someone accepts.</p>
        </div>

        {/* Staff coverage toggle — still available even after blast */}
        <StaffCoverageToggle isStaffCovered={isStaffCovered} isPending={isToggling} onToggle={handleToggleStaff} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {result && (
        <div className={`rounded-lg border p-4 ${result.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {result.message}
        </div>
      )}

      {/* Option A: Notify all subs */}
      <div className={`rounded-lg border bg-white p-6 ${notifyDisabled ? 'opacity-60' : 'border-gray-200'}`}>
        <h3 className="font-semibold text-gray-900 mb-1">Notify All Available Substitutes</h3>
        <p className="text-sm text-gray-500 mb-1">
          Send a notification to all substitutes in your pool. The first one to accept gets the position.
        </p>
        {isStaffCovered && (
          <p className="text-xs text-blue-600 mb-3">Disabled — this absence is covered by staff.</p>
        )}
        {selectedSubId && !isStaffCovered && (
          <p className="text-xs text-gray-400 mb-3">Disabled — deselect the substitute below to enable.</p>
        )}
        {!isStaffCovered && !selectedSubId && <div className="mb-4" />}
        <button
          onClick={handleNotifyAll}
          disabled={notifyDisabled}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isNotifying ? 'Sending...' : 'Send Notification to All Subs'}
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 text-sm text-gray-400">
        <div className="flex-1 border-t border-gray-200" />
        or
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {/* Option B: Assign directly */}
      <div className={`rounded-lg border border-gray-200 bg-white p-6 ${isStaffCovered ? 'opacity-60' : ''}`}>
        <h3 className="font-semibold text-gray-900 mb-1">Assign a Specific Substitute</h3>
        <p className="text-sm text-gray-500 mb-4">
          Pick a sub and assign them directly. No notification will be sent.
        </p>

        {!showAssignPanel ? (
          <button
            onClick={() => !isStaffCovered && setShowAssignPanel(true)}
            disabled={isStaffCovered || isPending}
            className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Choose a Substitute
          </button>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search substitutes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
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
                      onChange={() => setSelectedSubId(sub.id)}
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
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleAssignDirectly}
                disabled={!selectedSubId || isPending}
                className="bg-gray-900 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isAssigning ? 'Assigning...' : 'Assign This Sub'}
              </button>
              <button
                onClick={() => { setShowAssignPanel(false); setSelectedSubId(''); setSearch('') }}
                className="text-gray-500 px-4 py-2.5 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Staff Coverage Toggle */}
      <StaffCoverageToggle isStaffCovered={isStaffCovered} isPending={isToggling} onToggle={handleToggleStaff} />
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
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
              isStaffCovered ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  )
}
