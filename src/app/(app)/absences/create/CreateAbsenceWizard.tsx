/**
 * Create Absence Wizard — a 4-step form for reporting a teacher absence.
 *
 * This is a "client component" — it runs in the browser and can have
 * interactive state (which step you're on, what you've typed, etc.).
 *
 * Steps:
 *   1. Select Teacher  — search and click a teacher from the list
 *   2. Date & Time     — pick the date, hours, and reason
 *   3. Notes           — optional messages to admin, sub, or private notes
 *   4. Review & Submit — confirm everything looks right, then save
 *
 * Data flows in from the server (employees, absence reasons) and the
 * final submit calls a server action to save to the database.
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createAbsence } from '../actions'
import { FileUploadInput, type UploadedFile } from '@/components/FileUploadInput'
import { formatDateRange, countWeekdays, todayPT } from '@/lib/date-utils'
import {
  Search,
  User,
  Calendar,
  FileText,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Loader2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Employee = {
  id: string
  userId: string
  schoolId: string
  employeeType: string | null
  firstName: string
  lastName: string
  email: string
  schoolName: string
  schoolDayStart: string | null
  schoolDayEnd: string | null
}

type AbsenceReason = {
  id: string
  organizationId: string
  name: string
  isDefault: boolean | null
  sortOrder: number | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Converts 'YYYY-MM-DD' → 'Friday, May 3, 2026' */
function formatDate(dateStr: string) {
  // Adding noon time avoids off-by-one errors from timezone shifts
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** Converts '07:30' or '07:30:00' → '7:30 AM' */
function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

// todayPT() imported from @/lib/date-utils

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { number: 1, label: 'Teacher', icon: User },
  { number: 2, label: 'Date & Time', icon: Calendar },
  { number: 3, label: 'Notes', icon: FileText },
  { number: 4, label: 'Review', icon: CheckCircle },
]

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const Icon = step.icon
          const isCompleted = currentStep > step.number
          const isCurrent = currentStep === step.number

          return (
            <div key={step.number} className="flex items-center">
              {/* Circle with step number or check */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                    isCompleted
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : isCurrent
                      ? 'border-blue-600 bg-white text-blue-600'
                      : 'border-gray-300 bg-white text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={`mt-1 text-xs font-medium ${
                    isCurrent ? 'text-blue-600' : isCompleted ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line between steps */}
              {index < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 transition-colors ${
                    currentStep > step.number ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  style={{ width: '60px' }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 1: Select Teacher ───────────────────────────────────────────────────

function Step1SelectTeacher({
  employees,
  selectedEmployee,
  onSelect,
}: {
  employees: Employee[]
  selectedEmployee: Employee | null
  onSelect: (e: Employee) => void
}) {
  const [query, setQuery] = useState('')

  const filtered = employees.filter((e) => {
    const name = `${e.firstName} ${e.lastName}`.toLowerCase()
    const q = query.toLowerCase()
    return name.includes(q) || e.email.toLowerCase().includes(q) || e.schoolName.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Who is absent?</h2>
        <p className="text-sm text-gray-500">Search for the teacher or staff member who will be out.</p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email, or school..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Employee list */}
      {employees.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">No employees found. Add teachers in Settings first.</p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No results for &ldquo;{query}&rdquo;</div>
          ) : (
            filtered.map((employee) => {
              const isSelected = selectedEmployee?.id === employee.id
              return (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => onSelect(employee)}
                  className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-blue-50 ${
                    isSelected ? 'bg-blue-50' : 'bg-white'
                  }`}
                >
                  {/* Avatar circle with initials */}
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                    {employee.firstName[0]}{employee.lastName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                      {employee.firstName} {employee.lastName}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {employee.employeeType} · {employee.schoolName}
                    </p>
                  </div>
                  {isSelected && (
                    <CheckCircle className="h-5 w-5 flex-shrink-0 text-blue-600" />
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ─── Step 2: Date & Time ──────────────────────────────────────────────────────

function Step2DateTime({
  startDate, setStartDate,
  endDate, setEndDate,
  startTime, setStartTime,
  endTime, setEndTime,
  isFullDay, setIsFullDay,
  reasonId, setReasonId,
  substituteRequired, setSubstituteRequired,
  holdUntil, setHoldUntil,
  reasons,
  selectedEmployee,
}: {
  startDate: string; setStartDate: (v: string) => void
  endDate: string; setEndDate: (v: string) => void
  startTime: string; setStartTime: (v: string) => void
  endTime: string; setEndTime: (v: string) => void
  isFullDay: boolean; setIsFullDay: (v: boolean) => void
  reasonId: string; setReasonId: (v: string) => void
  substituteRequired: boolean; setSubstituteRequired: (v: boolean) => void
  holdUntil: string; setHoldUntil: (v: string) => void
  reasons: AbsenceReason[]
  selectedEmployee: Employee | null
}) {
  const numDays = countWeekdays(startDate, endDate === startDate ? null : endDate)

  // When full day is toggled, use the school's configured hours
  function handleFullDayToggle(checked: boolean) {
    setIsFullDay(checked)
    if (checked && selectedEmployee) {
      setStartTime(selectedEmployee.schoolDayStart?.slice(0, 5) || '07:30')
      setEndTime(selectedEmployee.schoolDayEnd?.slice(0, 5) || '15:30')
    }
  }

  // Ensure end date is never before start date
  function handleStartDateChange(v: string) {
    setStartDate(v)
    if (endDate < v) setEndDate(v)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">When are they out?</h2>
        <p className="text-sm text-gray-500">Set the date range, hours, and reason for the absence.</p>
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Start Date <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">End Date</label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>
      {numDays > 1 && (
        <p className="text-xs text-blue-600 -mt-3">{numDays} school days</p>
      )}

      {/* Full day toggle */}
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <input
          id="full-day"
          type="checkbox"
          checked={isFullDay}
          onChange={(e) => handleFullDayToggle(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600"
        />
        <label htmlFor="full-day" className="text-sm text-gray-700 cursor-pointer select-none">
          <span className="font-medium">Full school day</span>
          <span className="ml-2 text-gray-500">
            ({selectedEmployee?.schoolDayStart?.slice(0, 5) || '07:30'} –{' '}
            {selectedEmployee?.schoolDayEnd?.slice(0, 5) || '15:30'})
          </span>
        </label>
      </div>

      {/* Start / End time — shown even when full day is checked, so principal can adjust */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Start Time <span className="text-red-500">*</span></label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">End Time <span className="text-red-500">*</span></label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            required
          />
        </div>
      </div>

      {/* Absence reason */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Reason</label>
        <select
          value={reasonId}
          onChange={(e) => setReasonId(e.target.value)}
          className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">— Select a reason —</option>
          {reasons.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {/* Substitute required */}
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <input
          id="sub-required"
          type="checkbox"
          checked={substituteRequired}
          onChange={(e) => setSubstituteRequired(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600"
        />
        <label htmlFor="sub-required" className="text-sm text-gray-700 cursor-pointer select-none">
          <span className="font-medium">Substitute required</span>
          <span className="ml-2 text-gray-500">Uncheck if admin will cover</span>
        </label>
      </div>

      {/* Hold until — when to start notifying subs */}
      {substituteRequired && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Notify Substitutes</label>
          <select
            value={holdUntil}
            onChange={(e) => setHoldUntil(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="no_hold">Notify immediately</option>
            <option value="same_day_5am">Notify them the morning of the absence</option>
            <option value="day_before">Notify them the evening before (default)</option>
            <option value="admin_only">Hold — admin will assign manually</option>
          </select>
          <p className="text-xs text-gray-400">
            Controls when SubHub starts contacting available substitutes.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Step 3: Notes ────────────────────────────────────────────────────────────

function Step3Notes({
  notesToAdmin, setNotesToAdmin,
  notesToSub, setNotesToSub,
  adminOnlyNotes, setAdminOnlyNotes,
  attachments, setAttachments,
  orgId, userId,
}: {
  notesToAdmin: string; setNotesToAdmin: (v: string) => void
  notesToSub: string; setNotesToSub: (v: string) => void
  adminOnlyNotes: string; setAdminOnlyNotes: (v: string) => void
  attachments: UploadedFile[]; setAttachments: (v: UploadedFile[]) => void
  orgId: string; userId: string
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Any notes? <span className="ml-1 text-sm font-normal text-gray-400">(optional)</span></h2>
        <p className="text-sm text-gray-500">These will be visible to the sub and/or admin as specified.</p>
      </div>

      {/* Notes to admin */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Notes to Admin</label>
        <textarea
          value={notesToAdmin}
          onChange={(e) => setNotesToAdmin(e.target.value)}
          placeholder="E.g. Mrs. Johnson left lesson plans in room 204..."
          rows={3}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y"
        />
      </div>

      {/* Notes to sub */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Notes to Substitute</label>
        <textarea
          value={notesToSub}
          onChange={(e) => setNotesToSub(e.target.value)}
          placeholder="E.g. Class is 3rd period, room 204. Lesson plans on the desk..."
          rows={3}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y"
        />
        <p className="text-xs text-gray-400">The substitute will see this when they accept the job.</p>
      </div>

      {/* Admin-only notes (confidential) */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">
          Admin-Only Notes
          <span className="ml-2 rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800">Private</span>
        </label>
        <textarea
          value={adminOnlyNotes}
          onChange={(e) => setAdminOnlyNotes(e.target.value)}
          placeholder="Confidential notes — not visible to the teacher or substitute..."
          rows={3}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y"
        />
        <p className="text-xs text-gray-400">Only admins and school admins can see this.</p>
      </div>

      {/* File attachments */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Attachments</label>
        <FileUploadInput
          orgId={orgId}
          userId={userId}
          value={attachments}
          onChange={setAttachments}
        />
      </div>
    </div>
  )
}

// ─── Step 4: Review & Submit ──────────────────────────────────────────────────

function Step4Review({
  selectedEmployee,
  startDate,
  endDate,
  startTime,
  endTime,
  reasonName,
  substituteRequired,
  holdUntil,
  notesToAdmin,
  notesToSub,
  adminOnlyNotes,
  onSubmit,
  isPending,
  error,
}: {
  selectedEmployee: Employee
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  reasonName: string
  substituteRequired: boolean
  holdUntil: string
  notesToAdmin: string
  notesToSub: string
  adminOnlyNotes: string
  onSubmit: () => void
  isPending: boolean
  error: string
}) {
  const holdUntilLabels: Record<string, string> = {
    no_hold: 'Immediately',
    same_day_5am: 'Morning of the absence',
    day_before: 'Evening before the absence',
    admin_only: 'Admin will assign manually',
  }
  const numDays = countWeekdays(startDate, endDate === startDate ? null : endDate)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Review & Submit</h2>
        <p className="text-sm text-gray-500">Double-check everything before creating the absence.</p>
      </div>

      {/* Summary card */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 divide-y divide-gray-200">
        <ReviewRow label="Teacher" value={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`} />
        <ReviewRow label="School" value={selectedEmployee.schoolName} />
        <ReviewRow label="Date" value={formatDateRange(startDate, endDate === startDate ? null : endDate)} />
        {numDays > 1 && <ReviewRow label="Duration" value={`${numDays} school days`} />}
        <ReviewRow label="Time" value={`${formatTime(startTime)} – ${formatTime(endTime)}`} />
        {reasonName && <ReviewRow label="Reason" value={reasonName} />}
        <ReviewRow
          label="Substitute"
          value={substituteRequired ? `Required — notify ${holdUntilLabels[holdUntil] || 'immediately'}` : 'Not required'}
        />
        {notesToAdmin && <ReviewRow label="Notes to Admin" value={notesToAdmin} />}
        {notesToSub && <ReviewRow label="Notes to Sub" value={notesToSub} />}
        {adminOnlyNotes && <ReviewRow label="Admin-Only Notes" value={adminOnlyNotes} isPrivate />}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Submit button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating Absence...
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4" />
            Create Absence
          </>
        )}
      </button>
    </div>
  )
}

function ReviewRow({
  label,
  value,
  isPrivate = false,
}: {
  label: string
  value: string
  isPrivate?: boolean
}) {
  return (
    <div className="flex items-start gap-4 px-4 py-3">
      <span className="w-36 flex-shrink-0 text-sm text-gray-500">{label}</span>
      <span className={`flex-1 text-sm font-medium ${isPrivate ? 'text-yellow-800' : 'text-gray-900'}`}>
        {isPrivate && <span className="mr-1.5 rounded bg-yellow-100 px-1.5 py-0.5 text-xs">Private</span>}
        {value}
      </span>
    </div>
  )
}

// ─── Main Wizard Component ────────────────────────────────────────────────────

export function CreateAbsenceWizard({
  employees,
  absenceReasons,
  orgId,
  userId,
}: {
  employees: Employee[]
  absenceReasons: AbsenceReason[]
  orgId: string
  userId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Which step we're on (1–4)
  const [step, setStep] = useState(1)
  const [submitError, setSubmitError] = useState('')

  // Step 1 — teacher selection
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)

  // Step 2 — date range / time / reason
  const [startDate, setStartDate] = useState(todayPT())
  const [endDate, setEndDate] = useState(todayPT())
  const [startTime, setStartTime] = useState('07:30')
  const [endTime, setEndTime] = useState('15:30')
  const [isFullDay, setIsFullDay] = useState(false)
  const [reasonId, setReasonId] = useState(
    // Default to the first reason marked as default, or empty
    absenceReasons.find((r) => r.isDefault)?.id || ''
  )
  const [substituteRequired, setSubstituteRequired] = useState(true)
  const [holdUntil, setHoldUntil] = useState('day_before')

  // Step 3 — notes and attachments
  const [notesToAdmin, setNotesToAdmin] = useState('')
  const [notesToSub, setNotesToSub] = useState('')
  const [adminOnlyNotes, setAdminOnlyNotes] = useState('')
  const [attachments, setAttachments] = useState<UploadedFile[]>([])

  // Derived: name of the selected reason (for the review step)
  const selectedReason = absenceReasons.find((r) => r.id === reasonId)

  // Validation: can we proceed from the current step?
  function canGoNext() {
    if (step === 1) return selectedEmployee !== null
    if (step === 2) return startDate !== '' && startTime !== '' && endTime !== '' && endDate >= startDate
    return true
  }

  function handleNext() {
    if (canGoNext()) setStep((s) => Math.min(s + 1, 4))
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 1))
  }

  // Final submit — calls the server action to save to the database
  function handleSubmit() {
    if (!selectedEmployee) return
    setSubmitError('')

    startTransition(async () => {
      const result = await createAbsence({
        employeeId: selectedEmployee.id,
        schoolId: selectedEmployee.schoolId,
        startDate,
        endDate: endDate === startDate ? null : endDate,
        startTime,
        endTime,
        reasonId: reasonId || null,
        notesToAdmin,
        notesToSub,
        adminOnlyNotes,
        substituteRequired,
        holdUntil,
        attachments,
      })

      if (result?.error) {
        setSubmitError(result.error)
      } else {
        // Redirect to approve page so the principal can immediately approve the new absence
        router.push('/absences/approve')
        router.refresh()
      }
    })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <StepIndicator currentStep={step} />

      {/* Step content */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {step === 1 && (
          <Step1SelectTeacher
            employees={employees}
            selectedEmployee={selectedEmployee}
            onSelect={setSelectedEmployee}
          />
        )}
        {step === 2 && (
          <Step2DateTime
            startDate={startDate} setStartDate={setStartDate}
            endDate={endDate} setEndDate={setEndDate}
            startTime={startTime} setStartTime={setStartTime}
            endTime={endTime} setEndTime={setEndTime}
            isFullDay={isFullDay} setIsFullDay={setIsFullDay}
            reasonId={reasonId} setReasonId={setReasonId}
            substituteRequired={substituteRequired} setSubstituteRequired={setSubstituteRequired}
            holdUntil={holdUntil} setHoldUntil={setHoldUntil}
            reasons={absenceReasons}
            selectedEmployee={selectedEmployee}
          />
        )}
        {step === 3 && (
          <Step3Notes
            notesToAdmin={notesToAdmin} setNotesToAdmin={setNotesToAdmin}
            notesToSub={notesToSub} setNotesToSub={setNotesToSub}
            adminOnlyNotes={adminOnlyNotes} setAdminOnlyNotes={setAdminOnlyNotes}
            attachments={attachments} setAttachments={setAttachments}
            orgId={orgId} userId={userId}
          />
        )}
        {step === 4 && selectedEmployee && (
          <Step4Review
            selectedEmployee={selectedEmployee}
            startDate={startDate}
            endDate={endDate}
            startTime={startTime}
            endTime={endTime}
            reasonName={selectedReason?.name || ''}
            substituteRequired={substituteRequired}
            holdUntil={holdUntil}
            notesToAdmin={notesToAdmin}
            notesToSub={notesToSub}
            adminOnlyNotes={adminOnlyNotes}
            onSubmit={handleSubmit}
            isPending={isPending}
            error={submitError}
          />
        )}
      </div>

      {/* Back / Next navigation — not shown on step 4 (has its own submit button) */}
      {step < 4 && (
        <div className="mt-4 flex justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={!canGoNext()}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {step === 3 ? 'Review Absence' : 'Next'}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      )}
    </div>
  )
}
