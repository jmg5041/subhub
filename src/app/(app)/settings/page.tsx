/**
 * Settings page — organization and school configuration.
 * 
 * Frontline settings include:
 * - General Info (org name, contact, timezone)
 * - Time Settings (school day start/end, period schedules)
 * - Preferred Subs (rank subs for each teacher)
 * - Excluded Subs (block subs from certain teachers/schools)
 * - Shared Files (upload sub plans, policies, etc.)
 * 
 * This is where admins configure the system for their district.
 */

import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-gray-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500">Configure your organization and school settings</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Settings coming in Phase 2.</p>
        <p className="mt-2 text-sm text-gray-400">
          Will include: general info, time settings, preferred/excluded subs, 
          and shared files.
        </p>
      </div>
    </div>
  );
}