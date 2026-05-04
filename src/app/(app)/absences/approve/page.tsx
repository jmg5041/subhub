/**
 * Approve Absences page — where principals review and approve teacher time-off requests.
 * 
 * In Frontline, this shows a list of pending absences with filters (by school,
 * date range, approval status) and bulk action buttons (approve all, deny).
 * 
 * Phase 2 will build the full approval workflow.
 */

import { ClipboardCheck } from 'lucide-react';

export default function ApproveAbsencesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-8 w-8 text-green-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approve Absences</h1>
          <p className="text-gray-500">Review and approve pending teacher time-off requests</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Approval workflow coming in Phase 2.</p>
        <p className="mt-2 text-sm text-gray-400">
          Will include: filterable table of pending absences, bulk approve/deny, 
          and per-absence approval with notes.
        </p>
      </div>
    </div>
  );
}