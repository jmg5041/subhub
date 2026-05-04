'use client'

/**
 * Client-side auth confirm page — handles implicit flow tokens from URL hash.
 *
 * Supabase recovery/magic-link emails use the implicit flow: tokens arrive
 * in the URL hash (#access_token=...) which servers never see. This client
 * component lets the Supabase browser SDK process those tokens, establish
 * a session (written to cookies), then hands off to /auth/portal for role-based
 * redirect. The server-side /auth/callback handles PKCE flow (OAuth, email invites).
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthConfirmPage() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading')

  useEffect(() => {
    const supabase = createClient()

    async function processHash() {
      // getSession() triggers the browser SDK to read the hash fragment and
      // exchange the tokens, writing the session to cookies automatically.
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        setStatus('error')
        return
      }

      // Session is now in cookies — /auth/portal will create the users row
      // from user_metadata (role, orgId, etc.) if this is a first-time accept.
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
