import { getAppBranding } from '@/lib/branding'
import SignupForm from './SignupForm'

export default async function SignupPage() {
  const branding = await getAppBranding()
  return <SignupForm appName={branding.appName} logoUrl={branding.logoUrl} />
}
