/**
 * Find Substitute page — search and view substitute profiles.
 * 
 * Principals use this to find available subs, see their ratings/skills,
 * and manually assign them to unfilled absences.
 * 
 * In Frontline, this has a search bar, filters (by school, skills, rating),
 * and a list of subs with profile cards.
 */

import { UserSearch } from 'lucide-react';

export default function FindSubstitutePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserSearch className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Find Substitute</h1>
          <p className="text-gray-500">Search for available substitutes by name, skills, or school</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Substitute search coming in Phase 3.</p>
        <p className="mt-2 text-sm text-gray-400">
          Will include: search bar, skill filters, rating display, 
          availability calendar, and quick-assign button.
        </p>
      </div>
    </div>
  );
}