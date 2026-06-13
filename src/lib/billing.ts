// Billing state computation — pure function, no DB calls

export type BillingState =
  | { status: 'active' }
  | { status: 'trial'; daysLeft: number }
  | { status: 'trial_ending'; daysLeft: number }  // ≤ 14 days left
  | { status: 'past_due' }
  | { status: 'expired' }

type OrgBillingFields = {
  subscriptionStatus: string | null
  paidThrough: string | null
}

export function getBillingState(org: OrgBillingFields): BillingState {
  const status = org.subscriptionStatus ?? 'trial'

  if (status === 'active') return { status: 'active' }
  if (status === 'past_due') return { status: 'past_due' }
  if (status === 'expired') return { status: 'expired' }

  if (status === 'trial') {
    if (!org.paidThrough) return { status: 'trial', daysLeft: 120 }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Append noon to avoid timezone off-by-one on date-only strings
    const expiry = new Date(org.paidThrough + 'T12:00:00')
    const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000)

    if (daysLeft <= 0) return { status: 'expired' }
    if (daysLeft <= 14) return { status: 'trial_ending', daysLeft }
    return { status: 'trial', daysLeft }
  }

  // 'comp' or anything else — treat as active
  return { status: 'active' }
}
