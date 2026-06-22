import { getAppBranding } from '@/lib/branding'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  const branding = await getAppBranding()
  return <LoginForm appName={branding.appName} logoUrl={branding.logoUrl} />
}
