'use client'

import { useState, useTransition } from 'react'
import { setSubSchoolAssignments } from '../actions'

type School = { id: string; name: string }

type Props = {
  subId: string
  schools: School[]
  assignedSchoolIds: string[]
}

export default function SchoolAssignmentEditor({ subId, schools, assignedSchoolIds }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedSchoolIds))
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function toggle(schoolId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(schoolId)) next.delete(schoolId)
      else next.add(schoolId)
      return next
    })
    setSaved(false)
  }

  function handleSave() {
    startTransition(async () => {
      await setSubSchoolAssignments(subId, [...selected])
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="font-semibold text-gray-900 mb-1">School Assignments</h2>
      <p className="text-sm text-gray-500 mb-4">
        Check the schools this substitute is available to work at.
      </p>

      {schools.length === 0 ? (
        <p className="text-sm text-gray-400">No schools configured yet.</p>
      ) : (
        <ul className="space-y-2 mb-5">
          {schools.map(school => (
            <li key={school.id}>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selected.has(school.id)}
                  onChange={() => toggle(school.id)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-800 group-hover:text-gray-900">
                  {school.name}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={isPending || schools.length === 0}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving...' : 'Save Assignments'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
      </div>
    </div>
  )
}
