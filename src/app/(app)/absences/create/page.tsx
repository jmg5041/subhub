/**
 * Create Absence page — server wrapper for the wizard.
 *
 * This is a Server Component: it runs on the server, fetches the employee
 * list and absence reasons from the database, then passes them to the
 * interactive wizard component (which runs in the browser).
 *
 * This pattern keeps the database calls on the server (safe, fast) while
 * the interactive form logic runs in the browser.
 */

import { CalendarPlus } from 'lucide-react'
import { CreateAbsenceWizard } from './CreateAbsenceWizard'
import { getEmployees, getAbsenceReasons, getUserContext } from '../actions'

export default async function CreateAbsencePage() {
  // Fetch all data in parallel
  const [employees, absenceReasons, { orgId, userId }] = await Promise.all([
    getEmployees(),
    getAbsenceReasons(),
    getUserContext(),
  ])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <CalendarPlus className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Absence</h1>
          <p className="text-gray-500">Report a teacher absence and find a substitute</p>
        </div>
      </div>

      {/* The 4-step wizard */}
      <CreateAbsenceWizard
        employees={employees}
        absenceReasons={absenceReasons}
        orgId={orgId}
        userId={userId}
      />
    </div>
  )
}
