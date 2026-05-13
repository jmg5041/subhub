'use client'

/**
 * Teacher absence form — single-page, no wizard.
 * Teachers fill in the basics; admin handles the rest.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitAbsenceRequest } from '../../../actions'

type Reason = { id: string; name: string }
type Sub = { id: string; firstName: string; lastName: string }

export default function TeacherAbsenceForm({
  reasons,
  subs,
  schoolDayStart,
  schoolDayEnd,
  timezone,
}: {
  reasons: Reason[]
  subs: Sub[]
  schoolDayStart: string
  schoolDayEnd: string
  timezone: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isFullDay, setIsFullDay] = useState(true)
  const [startTime, setStartTime] = useState(schoolDayStart.slice(0, 5))
  const [endTime, setEndTime] = useState(schoolDayEnd.slice(0, 5))
  const [reasonId, setReasonId] = useState('')
  const [subRequired, setSubRequired] = useState(true)
  const [notesToSub, setNotesToSub] = useState('')
  const [requestedSubId, setRequestedSubId] = useState('')

  function handleStartDateChange(val: string) {
    setStartDate(val)
    // Keep endDate >= startDate
    if (endDate && endDate < val) setEndDate(val)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!startDate) { setError('Please select a start date.'); return }
    setError(null)

    startTransition(async () => {
      const res = await submitAbsenceRequest({
        startDate,
        endDate: endDate && endDate !== startDate ? endDate : null,
        startTime: isFullDay ? schoolDayStart.slice(0, 5) : startTime,
        endTime: isFullDay ? schoolDayEnd.slice(0, 5) : endTime,
        reasonId: reasonId || null,
        substituteRequired: subRequired,
        notesToSub,
        requestedSubId: requestedSubId || null,
      })

      if ('error' in res) {
        setError(String(res.error))
      } else {
        router.push('/teacher/absences')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-6 space-y-5">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Date range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date <span className="text-red-500">*</span></label>
          <input
            type="date"
            required
            value={startDate}
            onChange={e => handleStartDateChange(e.target.value)}
            min={new Date().toLocaleDateString('en-CA', { timeZone: timezone })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date <span className="text-gray-400 font-normal">(leave blank for single day)</span>
          </label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            min={startDate || new Date().toLocaleDateString('en-CA', { timeZone: timezone })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Full day toggle */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isFullDay}
            onChange={e => setIsFullDay(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="text-sm font-medium text-gray-700">Full day</span>
          <span className="text-xs text-gray-400">({schoolDayStart.slice(0,5)} – {schoolDayEnd.slice(0,5)})</span>
        </label>
      </div>

      {/* Custom times */}
      {!isFullDay && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start time</label>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End time</label>
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Reason */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
        <select
          value={reasonId}
          onChange={e => setReasonId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Select a reason —</option>
          {reasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {/* Sub required */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={subRequired}
            onChange={e => setSubRequired(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="text-sm font-medium text-gray-700">Substitute required</span>
        </label>
        <p className="text-xs text-gray-400 mt-1 ml-6">Uncheck if administration will cover the class.</p>
      </div>

      {/* Notes for sub */}
      {subRequired && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes for the substitute</label>
          <textarea
            value={notesToSub}
            onChange={e => setNotesToSub(e.target.value)}
            rows={3}
            placeholder="Lesson plan, seating chart location, class expectations..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      )}

      {/* Request specific sub */}
      {subRequired && subs.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Request a specific substitute <span className="text-gray-400 font-normal">(optional)</span></label>
          <select
            value={requestedSubId}
            onChange={e => setRequestedSubId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Any available substitute —</option>
            {subs.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
          </select>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Submitting...' : 'Submit Request'}
        </button>
        <a href="/teacher/absences" className="px-4 py-2.5 text-gray-500 hover:text-gray-700 text-sm">
          Cancel
        </a>
      </div>
    </form>
  )
}
