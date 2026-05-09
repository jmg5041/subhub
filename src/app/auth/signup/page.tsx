import { redirect } from 'next/navigation'

// All onboarding is invite-only — direct signup is not supported.
// Users receive an invite email from their admin and set their password via that link.
export default function SignupPage() {
  redirect('/auth/login')
}
