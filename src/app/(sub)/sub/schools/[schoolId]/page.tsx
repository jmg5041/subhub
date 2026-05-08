/**
 * School Profile page — shown when a sub taps a school name on their job detail.
 *
 * Displays:
 *   • School name and address (with Google Maps link)
 *   • School hours (day start / end time)
 *   • Phone number (tap-to-call on mobile)
 *   • Website link
 *   • City / state
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Phone, Globe, Clock } from 'lucide-react'
import { getSchoolProfile } from '../../../actions'

function formatTime(t: string): string {
  const [hourStr, min] = t.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:${min} ${ampm}`
}

function mapsUrl(school: { address?: string | null; city?: string | null; state?: string | null; name: string }): string {
  const query = [school.address, school.city, school.state].filter(Boolean).join(', ') || school.name
  return `https://maps.google.com/?q=${encodeURIComponent(query)}`
}

export default async function SchoolProfilePage({
  params,
}: {
  params: Promise<{ schoolId: string }>
}) {
  const { schoolId } = await params
  const school = await getSchoolProfile(schoolId)
  if (!school) notFound()

  const hasAddress = school.address || school.city

  return (
    <div className="max-w-lg mx-auto space-y-5 py-6 px-4">
      {/* Back */}
      <Link href="/sub/dashboard" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600">
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      {/* School name */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
        {school.city && (
          <p className="text-sm text-gray-500 mt-0.5">{school.city}{school.state && `, ${school.state}`}</p>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">

        {/* Address + map link */}
        {hasAddress && (
          <a
            href={mapsUrl(school)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors group"
          >
            <MapPin className="h-5 w-5 flex-shrink-0 text-blue-500 mt-0.5" />
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Address</div>
              <div className="text-sm font-medium text-blue-600 group-hover:underline">
                {school.address && <span>{school.address}<br /></span>}
                {school.city}{school.state && `, ${school.state}`}{school.zip && ` ${school.zip}`}
              </div>
              <div className="text-xs text-gray-400 mt-1">Tap to open in Maps</div>
            </div>
          </a>
        )}

        {/* School hours */}
        {school.dayStartTime && school.dayEndTime && (
          <div className="flex items-start gap-3 px-5 py-4">
            <Clock className="h-5 w-5 flex-shrink-0 text-orange-500 mt-0.5" />
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">School Hours</div>
              <div className="text-sm font-medium text-gray-800">
                {formatTime(school.dayStartTime)} – {formatTime(school.dayEndTime)}
              </div>
            </div>
          </div>
        )}

        {/* Phone */}
        {school.phone && (
          <a
            href={`tel:${school.phone}`}
            className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors group"
          >
            <Phone className="h-5 w-5 flex-shrink-0 text-green-500 mt-0.5" />
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Main Office</div>
              <div className="text-sm font-medium text-blue-600 group-hover:underline">{school.phone}</div>
              <div className="text-xs text-gray-400 mt-1">Tap to call</div>
            </div>
          </a>
        )}

        {/* Website */}
        {school.website && (
          <a
            href={school.website.startsWith('http') ? school.website : `https://${school.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors group"
          >
            <Globe className="h-5 w-5 flex-shrink-0 text-purple-500 mt-0.5" />
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Website</div>
              <div className="text-sm font-medium text-blue-600 group-hover:underline">
                {school.website.replace(/^https?:\/\//, '')}
              </div>
            </div>
          </a>
        )}
      </div>
    </div>
  )
}
