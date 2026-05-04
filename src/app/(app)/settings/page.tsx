/**
 * Settings page — notification preferences and sub priority order.
 *
 * Section 1: Auto-notify toggle — auto-send notifications on approval vs manual
 * Section 2: Notification channels — Email, SMS (coming soon), Phone (Phase 4)
 * Section 3: Sub priority order — rank which subs are called first
 */

import { Settings } from 'lucide-react'
import { getOrgSettings } from './actions'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const { org, subs } = await getOrgSettings()

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-gray-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500">Configure how substitutes are notified and contacted.</p>
        </div>
      </div>

      <SettingsClient
        initialAutoNotify={org?.autoNotifySubs ?? true}
        initialEmail={org?.notifyByEmail ?? true}
        initialSms={org?.notifyBySms ?? true}
        initialPhone={org?.notifyByPhone ?? false}
        subs={subs}
      />
    </div>
  )
}
