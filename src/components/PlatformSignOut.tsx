'use client'

import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function PlatformSignOut() {
  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <button onClick={handleSignOut} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm">
      <LogOut className="h-4 w-4" /> Sign out
    </button>
  )
}
