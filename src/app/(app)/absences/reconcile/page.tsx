/**
 * Reconcile Absences page — confirm that substitutes actually worked their assignments.
 * 
 * After a sub fills in, the principal needs to confirm:
 * - Did the sub show up?
 * - Did they work the full time?
 * - Any issues?
 * 
 * This reconciles the planned assignment with what actually happened,
 * which feeds into payroll (and eventually ADP integration).
 */

import { ClipboardList } from 'lucide-react';

export default function ReconcileAbsencesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-8 w-8 text-purple-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reconcile Absences</h1>
          <p className="text-gray-500">Confirm substitute attendance and hours</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Reconciliation workflow coming in Phase 2.</p>
        <p className="mt-2 text-sm text-gray-400">
          Will include: past assignments list, confirm/deny attendance, 
          actual hours worked, and rating subs.
        </p>
      </div>
    </div>
  );
}