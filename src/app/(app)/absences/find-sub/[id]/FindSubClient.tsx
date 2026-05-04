'use client'

/**
 * Find Sub page — client-side interactive portion.
 *
 * Lets the admin either:
 *   A) Assign a specific sub directly (no notification sent), or
 *   B) Notify all available subs at once (first to accept wins)
 *
 * The server component (page.tsx) loads the data; this component handles the UI state.
 */

import { useState, useTransition } from 'react'
import { assignSubDirectly, notifyAllSubsAction } from '../../actions'

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
}

export default function FindSubClient({ timeOffId, subs, isAlreadyFilled, filledByName, outreachStatus }: Props) {
  const [selectedSubId, setSelectedSubId] = useState('')
  const [search, setSearch] = useState('')
  const [showAssignPanel, setShowAssignPanel] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const filteredSubs = subs.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase())
  )

  function handleAssignDirectly() {
    if (!selectedSubId) return
    const sub = subs.find(s => s.id === selectedSubId)
    if (!confirm(`Assign ${sub?.firstName} ${sub?.lastName} to this absence? No notification will be sent.`)) return

    startTransition(async () => {
      const formData = new FormData()
      formData.set('timeOffId', timeOffId)
      formData.set('substituteId', selectedSubId)
      const res = await assignSubDirectly(formData)
      if (res.success) {
        setResult({ message: `${sub?.firstName} ${sub?.lastName} has been assigned.`, type: 'success' })
      } else {
        setResult({ message: 'Something went wrong. Please try again.', type: 'error' })
      }
    })
  }

  function handleNotifyAll() {
    if (!confirm('Send a notification email to all available substitutes? The first to accept will be assigned.')) return

    startTransition(async () => {
      const res = await notifyAllSubsAction(timeOffId)
      if ('sent' in res) {
        setResult({
          message: `Notifications sent to ${res.sent} substitute${res.sent !== 1 ? 's' : ''}. They will receive an email with accept/decline links.`,
          type: 'success',
        })
      } else {
        setResult({ message: 'Failed to send notifications. Please try again.', type: 'error' })
      }
    })
  }

  if (isAlreadyFilled) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <div className="text-2xl font-semibold text-green-700 mb-1">Position Filled</div>
        {filledByName && <p className="text-green-600">Covered by {filledByName}</p>}
      </div>
    )
  }

  if (outreachStatus === 'sent' && !result) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <div className="text-lg font-semibold text-blue-700 mb-1">Notifications Sent</div>
        <p className="text-blue-600 text-sm">Substitutes have been emailed. The first to accept will be assigned. This page will update when someone accepts.</p>
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
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Notify All Available Substitutes</h3>
        <p className="text-sm text-gray-500 mb-4">
          Send an email to all substitutes in your pool. The first one to accept gets the position.
        </p>
        <button
          onClick={handleNotifyAll}
          disabled={isPending}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Sending...' : 'Send Notification to All Subs'}
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 text-sm text-gray-400">
        <div className="flex-1 border-t border-gray-200" />
        or
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {/* Option B: Assign directly */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Assign a Specific Substitute</h3>
        <p className="text-sm text-gray-500 mb-4">
          Pick a sub and assign them directly. No notification email will be sent — you can contact them yourself.
        </p>

        {!showAssignPanel ? (
          <button
            onClick={() => setShowAssignPanel(true)}
            className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
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
                {isPending ? 'Assigning...' : 'Assign This Sub'}
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
    </div>
  )
}
