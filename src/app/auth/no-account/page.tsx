import Link from 'next/link'

export default function NoAccountPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center space-y-5">

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <div>
          <h1 className="text-xl font-bold text-gray-900">Account not found</h1>
          <p className="text-sm text-gray-500 mt-2">
            Your login was successful, but your account isn&apos;t connected to any school on SubHub.
          </p>
        </div>

        <div className="text-sm text-gray-600 space-y-2 text-left bg-gray-50 rounded-lg p-4">
          <p className="font-medium text-gray-700">This can happen if:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-500">
            <li>You were invited but used a different email to log in</li>
            <li>Your school&apos;s account has been deactivated</li>
            <li>You haven&apos;t been invited yet — contact your school admin</li>
          </ul>
        </div>

        <div className="space-y-3">
          <Link
            href="/auth/signup"
            className="block w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Sign up your school
          </Link>
          <a
            href="mailto:info@substitutes.us"
            className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Contact SubHub support
          </a>
          <Link
            href="/auth/login"
            className="block text-sm text-gray-400 hover:text-gray-600 hover:underline"
          >
            ← Back to login
          </Link>
        </div>

      </div>
    </div>
  )
}
