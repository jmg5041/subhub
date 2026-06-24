'use client'

import { useState, useTransition } from 'react'
import { ChevronLeft, School, Users } from 'lucide-react'
import { saveSchoolPriorityOrder, setPriorityCallingEnabled } from './actions'

type Sub = { id: string; firstName: string; lastName: string; email: string | null }
type SchoolRecord = { id: string; name: string; priorityCallingEnabled: boolean }

type Props = {
  subs: Sub[]
  schools: SchoolRecord[]
  priorityBySchool: Record<string, string[]>
  activeSubsBySchool: Record<string, string[]>
}

export default function PriorityTab({ subs, schools, priorityBySchool, activeSubsBySchool }: Props) {
  const [selectedSchool, setSelectedSchool] = useState<SchoolRecord | null>(null)
  const [schoolStates, setSchoolStates] = useState<Record<string, boolean>>(
    Object.fromEntries(schools.map(s => [s.id, s.priorityCallingEnabled]))
  )
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function selectSchool(school: SchoolRecord) {
    const schoolSubIds = new Set(activeSubsBySchool[school.id] ?? [])
    const eligibleSubs = subs.filter(s => schoolSubIds.has(s.id))
    const ranked = priorityBySchool[school.id] ?? []
    const rankedSet = new Set(ranked)
    const unranked = eligibleSubs.filter(s => !rankedSet.has(s.id)).map(s => s.id)
    setOrderedIds([...ranked.filter(id => eligibleSubs.find(s => s.id === id)), ...unranked])
    setSelectedSchool(school)
    setSaved(false)
  }

  function togglePriorityCalling(school: SchoolRecord) {
    const newVal = !schoolStates[school.id]
    setSchoolStates(prev => ({ ...prev, [school.id]: newVal }))
    startTransition(async () => {
      await setPriorityCallingEnabled(school.id, newVal)
    })
  }

  function moveUp(index: number) {
    if (index === 0) return
    const next = [...orderedIds]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    setOrderedIds(next)
    setSaved(false)
  }

  function moveDown(index: number) {
    if (index === orderedIds.length - 1) return
    const next = [...orderedIds]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    setOrderedIds(next)
    setSaved(false)
  }

  function handleSave() {
    if (!selectedSchool) return
    startTransition(async () => {
      await saveSchoolPriorityOrder(orderedIds, selectedSchool.id)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  const subMap = new Map(subs.map(s => [s.id, s]))

  // ── School selector view ──
  if (!selectedSchool) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Call Priority Order</h2>
          <p className="text-sm text-gray-500 mb-2">
            By default, all subs assigned to a school are notified at the same time when a position opens.
            Enable priority calling for a school if you want to control who gets called first.
          </p>
          <p className="text-xs text-gray-400 mb-5">
            Even with priority calling on, everyone still gets notified — the order just determines
            who appears first in the IVR phone menu and how they are ranked.
          </p>

          {schools.length === 0 ? (
            <p className="text-sm text-gray-400">No schools configured yet. Add schools in <strong>Admin → Schools</strong>.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {schools.map(school => {
                const assignedCount = (activeSubsBySchool[school.id] ?? []).length
                const priorityOn = schoolStates[school.id] ?? false
                return (
                  <div
                    key={school.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-4"
                  >
                    <School className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">{school.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {assignedCount > 0
                          ? `${assignedCount} ${assignedCount === 1 ? 'sub' : 'subs'} assigned`
                          : 'No subs assigned yet'}
                        {priorityOn && ' · Priority calling on'}
                      </div>
                    </div>

                    {/* Priority calling toggle */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-500 hidden sm:inline">Priority calling</span>
                      <button
                        onClick={() => togglePriorityCalling(school)}
                        disabled={isPending}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                          priorityOn ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                        title={priorityOn ? 'Priority calling on — click to disable' : 'Priority calling off — click to enable'}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                            priorityOn ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Edit order button — only when priority is on */}
                    {priorityOn && (
                      <button
                        onClick={() => selectSchool(school)}
                        className="flex-shrink-0 text-xs text-blue-600 hover:underline ml-1"
                      >
                        Edit order
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Per-school rank editor (only reachable when priority calling is on) ──
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setSelectedSchool(null)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            All schools
          </button>
          <span className="text-gray-300">/</span>
          <h2 className="font-semibold text-gray-900">{selectedSchool.name}</h2>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Set the order subs are ranked for <strong>{selectedSchool.name}</strong>.
          All subs still get notified at the same time — this order controls the phone menu ("Press 1 for...").
        </p>

        {orderedIds.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 px-6 py-8 text-center">
            <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">No substitutes assigned to this school yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Go to <strong>Sub Roster</strong>, click a sub&apos;s name, and check this school under School Assignments.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
            {orderedIds.map((id, index) => {
              const sub = subMap.get(id)
              if (!sub) return null
              return (
                <li key={id} className="flex items-center gap-3 px-4 py-3 bg-white">
                  <span className="text-xs font-mono text-gray-400 w-5 text-right">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {sub.firstName} {sub.lastName}
                    </div>
                    {sub.email && <div className="text-xs text-gray-400 truncate">{sub.email}</div>}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                    >▲</button>
                    <button
                      onClick={() => moveDown(index)}
                      disabled={index === orderedIds.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                    >▼</button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex items-center gap-4 mt-5">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving...' : 'Save Order'}
          </button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
        </div>
      </div>
    </div>
  )
}
