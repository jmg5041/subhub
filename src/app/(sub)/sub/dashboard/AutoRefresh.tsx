'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Silently re-fetches the page every 30 seconds so filled sub jobs
// disappear from the pending list without a manual refresh.
export default function AutoRefresh() {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000)
    return () => clearInterval(id)
  }, [router])
  return null
}
