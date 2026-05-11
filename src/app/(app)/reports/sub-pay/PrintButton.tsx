'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 print:hidden"
    >
      Print
    </button>
  )
}
