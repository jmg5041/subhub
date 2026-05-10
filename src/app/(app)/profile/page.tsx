import { UserCircle } from 'lucide-react'
import { getAdminProfile, getSchoolPrefs } from './actions'
import AdminProfileForm from './AdminProfileForm'

export default async function AdminProfilePage() {
  const [profile, schoolPrefs] = await Promise.all([
    getAdminProfile(),
    getSchoolPrefs(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserCircle className="h-8 w-8 text-blue-600 flex-shrink-0" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-500 mt-0.5">Manage your name, photo, and contact info.</p>
        </div>
      </div>

      <AdminProfileForm
        firstName={profile.firstName}
        lastName={profile.lastName}
        email={profile.email ?? ''}
        phone={profile.phone}
        role={profile.role}
        avatarUrl={profile.avatarUrl}
        schoolPrefs={schoolPrefs}
      />
    </div>
  )
}
