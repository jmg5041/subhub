/**
 * Substitute seed script — loads real Southlands substitutes from the Frontline CSV export.
 *
 * Run with: npm run db:seed-subs
 *
 * What it does:
 * - Creates a `users` record for each unique substitute (role = 'substitute')
 * - Creates a `substitutes` record with their preferred school levels
 * - Safe to run multiple times — skips anyone who already exists by email
 *
 * Notes from the source data:
 * - Subs who appear at multiple school levels get those schools in their preferredAtSchools list
 * - Yunia Pak shows "Prefers Location = No" for ES/MS/HS — she's available but doesn't prefer those
 * - Gary Surdam already has a test record (gary.surdam@sub.test) — this adds his real record
 * - Lee, Alyssa had no email in the export — using alee@southlandscs.com as placeholder
 */

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'
import { eq } from 'drizzle-orm'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load .env.local
try {
  const envFile = readFileSync(join(process.cwd(), '.env.local'), 'utf-8')
  for (const line of envFile.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const [, key, value] = match
      if (!process.env[key.trim()]) process.env[key.trim()] = value.trim()
    }
  }
} catch { /* env already set */ }

const connectionString = process.env.DATABASE_URL_DIRECT!
if (!connectionString) throw new Error('DATABASE_URL_DIRECT is not set in .env.local')

const client = postgres(connectionString, { ssl: { rejectUnauthorized: false } })
const db = drizzle(client, { schema })

// ─── School level → Southlands school name ───────────────────────────────────

const LEVEL_TO_SCHOOL: Record<string, string> = {
  'Elementary':   'Southlands Christian Elementary School',
  'Preschool':    'Southlands Christian Preschool',
  'Middle School':'Southlands Christian Middle School',
  'High School':  'Southlands Christian High School',
}

// ─── Substitute data (parsed from Frontline CSV) ──────────────────────────────
// preferredAt: school levels where "Prefers Location = Yes"
// availableAt: all school levels they're listed for (superset of preferredAt)

const SUBS: {
  firstName: string
  lastName: string
  phone: string
  email: string
  preferredAt: string[]  // school levels they prefer
  availableAt: string[]  // all school levels they cover
}[] = [
  {
    firstName: 'Eva',       lastName: 'Altamirano',
    phone: '(818) 573-0385', email: 'ealtamirano@southlandscs.com',
    preferredAt: ['Elementary', 'Middle School'],
    availableAt: ['Elementary', 'Middle School'],
  },
  {
    firstName: 'Israel',    lastName: 'Anguiano',
    phone: '(626) 404-4094', email: 'ianguiano@southlandscs.com',
    preferredAt: ['Elementary', 'Preschool', 'Middle School', 'High School'],
    availableAt: ['Elementary', 'Preschool', 'Middle School', 'High School'],
  },
  {
    firstName: 'Shirley',   lastName: 'Auyeung',
    phone: '(626) 242-8980', email: 'sauyeung@southlandscs.com',
    preferredAt: ['Elementary', 'Middle School'],
    availableAt: ['Elementary', 'Middle School'],
  },
  {
    firstName: 'Rachel',    lastName: 'Capinia',
    phone: '(626) 715-2683', email: 'rcapinia@southlandscs.com',
    preferredAt: ['Middle School', 'High School'],
    availableAt: ['Middle School', 'High School'],
  },
  {
    firstName: 'Norma',     lastName: 'Cole',
    phone: '(909) 816-8727', email: 'ncole@southlandscs.com',
    preferredAt: ['Elementary', 'Middle School', 'High School'],
    availableAt: ['Elementary', 'Middle School', 'High School'],
  },
  {
    firstName: 'Vanessa',   lastName: 'Kelenjian',
    phone: '(626) 208-7709', email: 'vkelenjian@southlandscs.com',
    preferredAt: ['Elementary', 'Preschool', 'Middle School', 'High School'],
    availableAt: ['Elementary', 'Preschool', 'Middle School', 'High School'],
  },
  {
    firstName: 'Ian',       lastName: 'Lam',
    phone: '(858) 231-9710', email: 'ilam@southlandscs.com',
    preferredAt: ['Elementary', 'Middle School'],
    availableAt: ['Elementary', 'Middle School'],
  },
  {
    firstName: 'Sam',       lastName: 'Lanka',
    phone: '(714) 414-8264', email: 'slanka@southlandscs.com',
    preferredAt: ['Elementary', 'Preschool', 'Middle School', 'High School'],
    availableAt: ['Elementary', 'Preschool', 'Middle School', 'High School'],
  },
  {
    // No email in Frontline export — placeholder generated
    firstName: 'Alyssa',   lastName: 'Lee',
    phone: '(646) 255-2079', email: 'alee@southlandscs.com',
    preferredAt: ['High School'],
    availableAt: ['High School'],
  },
  {
    firstName: 'Luciana',   lastName: 'Manicone',
    phone: '(562) 457-8414', email: 'lmanicone@southlandscs.com',
    preferredAt: ['High School'],
    availableAt: ['High School'],
  },
  {
    firstName: 'Victoria',  lastName: 'Marcoe',
    phone: '(909) 277-8055', email: 'vmarcoe@southlandscs.com',
    preferredAt: ['Elementary', 'Middle School', 'High School'],
    availableAt: ['Elementary', 'Middle School', 'High School'],
  },
  {
    firstName: 'Isaiah',    lastName: 'Miranda',
    phone: '(951) 751-5978', email: 'imiranda@southlandscs.com',
    preferredAt: ['High School'],
    availableAt: ['High School'],
  },
  {
    // Prefers Location = No for ES/MS/HS, Yes for Preschool
    firstName: 'Yunia',     lastName: 'Pak',
    phone: '(714) 604-7139', email: 'ypak@southlandscs.com',
    preferredAt: ['Preschool'],
    availableAt: ['Elementary', 'Preschool', 'Middle School', 'High School'],
  },
  {
    firstName: 'Kaitlin',   lastName: 'Parks',
    phone: '(316) 207-6540', email: 'kparks@southlandscs.com',
    preferredAt: ['Middle School', 'High School'],
    availableAt: ['Middle School', 'High School'],
  },
  {
    firstName: 'Samuel',    lastName: 'Rickert',
    phone: '(858) 585-6923', email: 'srickert@southlandscs.com',
    preferredAt: ['High School'],
    availableAt: ['High School'],
  },
  {
    // Note: Gary M. Surdam — "M." dropped for simplicity. Test record gary.surdam@sub.test can be removed later.
    firstName: 'Gary',      lastName: 'Surdam',
    phone: '(951) 440-4561', email: 'gsurdam@southlandscs.com',
    preferredAt: ['Middle School', 'High School'],
    availableAt: ['Middle School', 'High School'],
  },
  {
    firstName: 'Kenneth',   lastName: 'Tran',
    phone: '(626) 758-8705', email: 'ktran@southlandscs.com',
    preferredAt: ['Elementary', 'Middle School', 'High School'],
    availableAt: ['Elementary', 'Middle School', 'High School'],
  },
  {
    firstName: 'Aurora',    lastName: 'Zhang',
    phone: '(626) 483-6749', email: 'azhang@southlandscs.com',
    preferredAt: ['Elementary', 'Middle School'],
    availableAt: ['Elementary', 'Middle School'],
  },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seedSubs() {
  console.log('🌱 Loading Southlands substitutes into database...\n')

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.slug, 'southlands'),
  })
  if (!org) throw new Error('Southlands organization not found — run npm run db:seed first')

  // Index schools by name for fast lookup
  const allSchools = await db
    .select()
    .from(schema.schools)
    .where(eq(schema.schools.organizationId, org.id))

  const schoolByName: Record<string, typeof allSchools[0]> = {}
  for (const s of allSchools) schoolByName[s.name] = s

  let created = 0
  let skipped = 0

  for (const sub of SUBS) {
    // Skip if this email already exists
    const existing = await db.query.users.findFirst({
      where: eq(schema.users.email, sub.email),
    })

    if (existing) {
      console.log(`  → skipped  ${sub.firstName} ${sub.lastName} (already in database)`)
      skipped++
      continue
    }

    // Resolve school IDs for preferred schools
    const preferredSchoolIds = sub.preferredAt
      .map(level => schoolByName[LEVEL_TO_SCHOOL[level]]?.id)
      .filter(Boolean) as string[]

    // Create the user record
    const [newUser] = await db
      .insert(schema.users)
      .values({
        email: sub.email,
        firstName: sub.firstName,
        lastName: sub.lastName,
        phone: sub.phone,
        role: 'substitute',
        organizationId: org.id,
        schoolId: null, // Subs aren't tied to one school
      })
      .returning()

    // Create the substitute profile record
    await db.insert(schema.substitutes).values({
      userId: newUser.id,
      preferredAtSchools: preferredSchoolIds,
      excludedFromSchools: [],
      skills: [],
      rating: '0',
      ratingCount: 0,
    })

    const schoolList = sub.availableAt.join(', ')
    console.log(`  ✓ added    ${sub.firstName} ${sub.lastName} [${schoolList}]`)
    created++
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Substitutes created: ${created}`)
  console.log(`   Substitutes skipped: ${skipped} (already in database)`)
  console.log(`\n🎉 Done! ${created + skipped} substitutes ready in SubHub.`)

  await client.end()
}

seedSubs().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
