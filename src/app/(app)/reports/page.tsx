/**
 * Reports page — access all absence and substitute reports.
 * 
 * Frontline has 12+ reports across 4 categories:
 * - Absence Reports (daily, detail, employee, reason summary)
 * - Substitute Reports (fill rate, availability, activity)
 * - Custom Reports (builder with configurable columns/filters)
 * - Administrative Reports (budget, payroll export)
 * 
 * Each report has date range filters, school filters, and export options.
 */

import { FileBarChart } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileBarChart className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500">Absence, substitute, and administrative reports</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Reports coming in Phase 5.</p>
        <p className="mt-2 text-sm text-gray-400">
          Will include: daily absence report, fill rate report, 
          employee absence history, substitute activity, and payroll export.
        </p>
      </div>
    </div>
  );
}