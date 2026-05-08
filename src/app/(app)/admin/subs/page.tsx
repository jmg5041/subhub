/**
 * Admin substitute directory — find subs by county.
 *
 * Unlike the "Manage Users" page which shows only your org's users,
 * this page shows subs across ALL orgs so you can discover subs in your area.
 */

import { getSubsByCounty, getSubCounties } from './actions'
import { SubDirectoryClient } from './SubDirectoryClient'

export default async function AdminSubDirectoryPage() {
  const counties = await getSubCounties()

  return <SubDirectoryClient counties={counties} />
}
