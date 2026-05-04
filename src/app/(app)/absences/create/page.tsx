/**
 * Create Absence page — where principals report a teacher absence.
 * 
 * This is the most important daily action. A principal comes here to say
 * "Mrs. Johnson is out sick today" and the system finds a substitute.
 * 
 * Phase 2 will build the full wizard (4 steps like Frontline):
 * 1. Select teacher
 * 2. Choose date, time, reason
 * 3. Add notes for sub
 * 4. Review & submit
 * 
 * For now this is a placeholder with the basic structure.
 */

import { CalendarPlus } from 'lucide-react';

export default function CreateAbsencePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CalendarPlus className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Absence</h1>
          <p className="text-gray-500">Report a teacher absence and find a substitute</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Absence creation wizard coming in Phase 2.</p>
        <p className="mt-2 text-sm text-gray-400">
          This will include: teacher selection, date/time picker, absence reason, 
          hold-until options, and notes for the substitute.
        </p>
      </div>
    </div>
  );
}