import { clearImpersonation } from '@/lib/impersonation-actions'

export function ImpersonationBanner({ orgName }: { orgName: string }) {
  return (
    <div className="bg-amber-400 text-amber-900 px-4 py-2 flex items-center justify-between text-sm font-medium print:hidden">
      <span>
        Viewing as: <strong>{orgName}</strong>
      </span>
      <form action={clearImpersonation}>
        <button
          type="submit"
          className="rounded bg-amber-900/20 px-3 py-1 text-xs font-semibold hover:bg-amber-900/30 transition-colors"
        >
          Exit to Platform
        </button>
      </form>
    </div>
  )
}
