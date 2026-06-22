/**
 * Settings page — notification preferences and sub priority order.
 *
 * Section 1: Auto-notify toggle — auto-send notifications on approval vs manual
 * Section 2: Notification channels — Email, SMS (coming soon), Phone (Phase 4)
 * Section 3: Sub priority order — rank which subs are called first
 */

import { Settings } from 'lucide-react'
import { getOrgSettings, saveOrgIdentity } from './actions'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const { org } = await getOrgSettings()

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-gray-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500">Configure how substitutes are notified and contacted.</p>
        </div>
      </div>

      {/* Organization identity */}
      <div className="rounded-lg border border-gray-200 bg-white px-6 py-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Organization</h2>
        <form action={saveOrgIdentity} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization name</label>
            <input name="name" defaultValue={org?.name ?? ''} required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
            <p className="text-xs text-gray-400 mt-1">Used in billing, emails, and reports.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              District name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input name="districtName" defaultValue={org?.districtName ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
            <p className="text-xs text-gray-400 mt-1">Formal district name shown on district-level views. Leave blank to use organization name.</p>
          </div>
          <button type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors">
            Save
          </button>
        </form>
      </div>

      <SettingsClient
        initialAutoNotify={org?.autoNotifySubs ?? true}
        initialEmail={org?.notifyByEmail ?? true}
        initialSms={org?.notifyBySms ?? true}
        initialPhone={org?.notifyByPhone ?? false}
        initialTimezone={org?.timezone ?? 'America/Los_Angeles'}
      />
    </div>
  )
}
