import { clearUserImpersonation } from '@/lib/impersonation-actions'

export function UserImpersonationBanner({
  firstName,
  lastName,
  role,
}: {
  firstName: string
  lastName: string
  role: string
}) {
  const portalLabel = role === 'substitute' ? 'Sub' : 'Teacher'

  return (
    <div className="bg-violet-500 text-white px-4 py-2 flex items-center justify-between text-sm font-medium print:hidden">
      <span>
        Viewing {portalLabel} portal as: <strong>{firstName} {lastName}</strong>
      </span>
      <form action={clearUserImpersonation}>
        <button
          type="submit"
          className="rounded bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 transition-colors"
        >
          Exit to Platform
        </button>
      </form>
    </div>
  )
}
