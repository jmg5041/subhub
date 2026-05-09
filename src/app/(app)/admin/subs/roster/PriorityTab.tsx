'use client'

import { useState, useTransition } from 'react'
import { ChevronLeft, School } from 'lucide-react'
import { saveSchoolPriorityOrder } from './actions'

type Sub = { id: string; firstName: string; lastName: string; email: string | null }
type SchoolRecord = { id: string; name: string }

type Props = {
  subs: Sub[]
  schools: SchoolRecord[]
  priorityBySchool: Record<string, string[]>
}

export default function PriorityTab({ subs, schools, priorityBySchool }: Props) {
  const [selectedSchool, setSelectedSchool] = useState<SchoolRecord | null>(null)
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function selectSchool(school: SchoolRecord) {
    const ranked = priorityBySchool[school.id] ?? []
    // Build ordered list: ranked subs first, then remaining alphabetically
    const rankedSet = new Set(ranked)
    const unranked = subs.filter(s => !rankedSet.has(s.id)).map(s => s.id)
    setOrderedIds([...ranked.filter(id => subs.find(s => s.id === id)), ...unranked])
    setSelectedSchool(school)
    setSaved(false)
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
          <p className="text-sm text-gray-500 mb-5">
            Select a school below to set the order in which substitutes are called for that campus.
          </p>

          {schools.length === 0 ? (
            <p className="text-sm text-gray-400">No schools configured yet. Add schools in <strong>Admin → Schools</strong>.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {schools.map(school => {
                const ranked = (priorityBySchool[school.id] ?? []).filter(id => subs.find(s => s.id === id))
                return (
                  <button
                    key={school.id}
                    onClick={() => selectSchool(school)}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 text-left hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <School className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{school.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {ranked.length > 0 ? `${ranked.length} subs ranked` : 'No priority set yet'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Per-school drag list ──
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
          Drag or use the arrows to set the order subs are called for <strong>{selectedSchool.name}</strong>.
          Subs at the top are called first.
        </p>

        {orderedIds.length === 0 ? (
          <p className="text-sm text-gray-400">No active substitutes found.</p>
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
            {isPending ? 'Saving...' : 'Save Priority Order'}
          </button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
        </div>
      </div>
    </div>
  )
}
