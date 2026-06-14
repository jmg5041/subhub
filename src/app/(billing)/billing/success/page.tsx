import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

export default function BillingSuccessPage() {
  return (
    <div className="flex flex-col items-center text-center py-12 gap-6">
      <CheckCircle className="w-16 h-16 text-green-500" />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">You&apos;re all set!</h1>
        <p className="text-gray-500 mt-2 max-w-sm">
          Your payment was successful. Your SubHub subscription is now active.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Go to Dashboard
      </Link>
    </div>
  )
}
