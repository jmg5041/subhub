'use client'

/**
 * Handles implicit-flow auth tokens that arrive in the URL hash (#access_token=...).
 *
 * The @supabase/ssr browser client is configured for PKCE flow and doesn't
 * automatically parse hash fragments. We parse them manually and call
 * setSession() directly, which writes the session to cookies so the
 * server-side /auth/portal route can read it for role-based redirect.
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthConfirmPage() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading')

  useEffect(() => {
    const supabase = createClient()

    async function processHash() {
      // Parse tokens from the URL hash
      const hash = window.location.hash.slice(1)
      const params = new URLSearchParams(hash)

      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const errorCode = params.get('error_code')

      if (errorCode || !accessToken || !refreshToken) {
        console.error('[auth/confirm] Missing tokens or error in hash:', errorCode)
        setStatus('error')
        return
      }

      // Explicitly set the session — writes to cookies so server routes can read it
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (error || !data.session) {
        console.error('[auth/confirm] setSession failed:', error)
        setStatus('error')
        return
      }

      // Session established — portal will create users row and redirect by role
      window.location.href = '/auth/portal'
    }

    processHash()
  }, [])

  if (status === 'error') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-red-600 text-sm">Sign-in failed — this link may have expired.</p>
        <a href="/auth/login" className="text-blue-600 text-sm hover:underline">Back to login</a>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-gray-500 text-sm">Signing you in…</p>
    </div>
  )
}
