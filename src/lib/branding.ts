import { db } from '@/db'

export type AppBranding = {
  appName: string
  logoUrl: string | null
}

export async function getAppBranding(): Promise<AppBranding> {
  try {
    const settings = await db.query.platformSettings.findFirst()
    return {
      appName: settings?.appName ?? 'SubHub',
      logoUrl: settings?.logoUrl ?? null,
    }
  } catch {
    // Migration not yet applied or table unavailable — return safe defaults
    return { appName: 'SubHub', logoUrl: null }
  }
}
