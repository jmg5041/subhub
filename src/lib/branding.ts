import { db } from '@/db'

export type AppBranding = {
  appName: string
  logoUrl: string | null
}

export async function getAppBranding(): Promise<AppBranding> {
  const settings = await db.query.platformSettings.findFirst()
  return {
    appName: settings?.appName ?? 'SubHub',
    logoUrl: settings?.logoUrl ?? null,
  }
}
