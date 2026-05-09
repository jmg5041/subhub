'use client'

/**
 * Settings page — interactive client component.
 *
 * Handles all three settings sections:
 *   1. Auto-notify toggle
 *   2. Notification channel checkboxes
 *   3. Sub priority order (move up/down)
 */

import { useState, useTransition } from 'react'
import { saveOrgSettings } from './actions'

type Props = {
  initialAutoNotify: boolean
  initialEmail: boolean
  initialSms: boolean
  initialPhone: boolean
}

export default function SettingsClient({ initialAutoNotify, initialEmail, initialSms, initialPhone }: Props) {
  const [autoNotify, setAutoNotify] = useState(initialAutoNotify)
  const [emailOn, setEmailOn] = useState(initialEmail)
  const [smsOn, setSmsOn] = useState(initialSms)
  const [phoneOn, setPhoneOn] = useState(initialPhone)
  const [saved, setSaved] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('autoNotifySubs', String(autoNotify))
      formData.set('notifyByEmail', String(emailOn))
      formData.set('notifyBySms', String(smsOn))
      formData.set('notifyByPhone', String(phoneOn))

      await saveOrgSettings(formData)
      setSaved('Settings saved.')
      setTimeout(() => setSaved(null), 3000)
    })
  }

  return (
    <div className="space-y-6">
      {/* Section 1 — Auto-notify */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Notification Flow</h2>
        <p className="text-sm text-gray-500 mb-5">
          Choose when substitutes are notified about open positions.
        </p>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="relative mt-0.5">
              <input
                type="radio"
                name="notifyFlow"
                checked={autoNotify}
                onChange={() => setAutoNotify(true)}
                className="sr-only"
              />
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${autoNotify ? 'border-blue-600' : 'border-gray-300'}`}
              >
                {autoNotify && <div className="w-2 h-2 rounded-full bg-blue-600" />}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Auto-notify on approval</div>
              <div className="text-xs text-gray-500">When you approve an absence, subs are notified immediately.</div>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="relative mt-0.5">
              <input
                type="radio"
                name="notifyFlow"
                checked={!autoNotify}
                onChange={() => setAutoNotify(false)}
                className="sr-only"
              />
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${!autoNotify ? 'border-blue-600' : 'border-gray-300'}`}
              >
                {!autoNotify && <div className="w-2 h-2 rounded-full bg-blue-600" />}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Manual — I&apos;ll send notifications myself</div>
              <div className="text-xs text-gray-500">Approved absences go to the Find Sub page where you can notify or assign manually.</div>
            </div>
          </label>
        </div>
      </div>

      {/* Section 2 — Channels */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Notification Channels</h2>
        <p className="text-sm text-gray-500 mb-5">
          Choose how substitutes receive notifications.
        </p>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailOn}
              onChange={e => setEmailOn(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">Email</div>
              <div className="text-xs text-gray-500">Subs receive an email with accept/decline links.</div>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-not-allowed opacity-60">
            <input
              type="checkbox"
              checked={smsOn}
              onChange={e => setSmsOn(e.target.checked)}
              disabled
              className="w-4 h-4 text-blue-600 rounded border-gray-300"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">
                SMS Text Message
                <span className="ml-2 text-xs font-normal bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Coming soon</span>
              </div>
              <div className="text-xs text-gray-500">Awaiting carrier registration (Twilio A2P 10DLC).</div>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-not-allowed opacity-60">
            <input
              type="checkbox"
              checked={phoneOn}
              onChange={e => setPhoneOn(e.target.checked)}
              disabled
              className="w-4 h-4 text-blue-600 rounded border-gray-300"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">
                Phone Call
                <span className="ml-2 text-xs font-normal bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Phase 4</span>
              </div>
              <div className="text-xs text-gray-500">Automated voice call — coming in a future release.</div>
            </div>
          </label>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && <span className="text-sm text-green-600">{saved}</span>}
      </div>
    </div>
  )
}
