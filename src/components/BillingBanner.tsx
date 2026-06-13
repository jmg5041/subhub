import type { BillingState } from '@/lib/billing'
import Link from 'next/link'

export function BillingBanner({ state }: { state: BillingState }) {
  if (state.status === 'active') return null
  if (state.status === 'trial' && state.daysLeft > 14) return null

  let message: string
  let linkLabel: string

  if (state.status === 'trial_ending') {
    message = `Your free trial expires in ${state.daysLeft} day${state.daysLeft === 1 ? '' : 's'}.`
    linkLabel = 'View billing options'
  } else if (state.status === 'past_due') {
    message = 'Your subscription is past due.'
    linkLabel = 'Update billing'
  } else {
    return null
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
      <span className="text-amber-800">{message}</span>
      <Link href="/billing" className="text-amber-700 font-medium underline hover:text-amber-900">
        {linkLabel}
      </Link>
    </div>
  )
}
