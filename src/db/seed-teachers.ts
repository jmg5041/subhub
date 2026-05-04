/**
 * Teacher seed script — loads real Southlands staff from the Frontline export.
 *
 * Run with: npm run db:seed-teachers
 *
 * What it does:
 * - Creates a user record for each unique staff member
 * - Creates employee records linking each person to their school(s)
 * - Itinerant teachers (like Luke James who covers 5 schools) get one user
 *   record but multiple employee records — one per school
 * - Uses placeholder emails like luz.avila@southlands.local (no login needed yet)
 * - Safe to run multiple times — skips anyone who already exists
 */

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'
import { eq, and } from 'drizzle-orm'

// Load .env.local for the database connection string
import { readFileSync } from 'fs'
import { join } from 'path'
try {
  const envFile = readFileSync(join(process.cwd(), '.env.local'), 'utf-8')
  for (const line of envFile.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const [, key, value] = match
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value.trim()
      }
    }
  }
} catch {
  // .env.local not found — assumes env vars are already in the environment
}

const connectionString = process.env.DATABASE_URL_DIRECT!
if (!connectionString) throw new Error('DATABASE_URL_DIRECT is not set in .env.local')

const client = postgres(connectionString, { ssl: { rejectUnauthorized: false } })
const db = drizzle(client, { schema })

// ─── School key → full Southlands school name ────────────────────────────────

const SCHOOL_KEY_TO_NAME: Record<string, string> = {
  Elementary: 'Southlands Christian Elementary School',
  High:       'Southlands Christian High School',
  Middle:     'Southlands Christian Middle School',
  Preschool:  'Southlands Christian Preschool',
  SCS:        'Southlands Christian School',
}

// ─── Staff data from Frontline export ────────────────────────────────────────
// schools: list of school keys this person teaches at
// role: their role in SubHub ('teacher', 'principal', 'admin')
// type: their employee type ('Teacher', 'Admin')

const STAFF: {
  firstName: string
  lastName: string
  phone: string
  schools: string[]
  role: 'teacher' | 'principal' | 'admin'
  type: 'Teacher' | 'Admin'
  title?: string
}[] = [
  // ── Elementary School ───────────────────────────────────────────────────────
  { firstName: 'Luz',       lastName: 'Avila',                 phone: '(626) 650-8439', schools: ['Elementary'],                              role: 'teacher',   type: 'Teacher' },
  { firstName: 'Frances',   lastName: 'Blackschleger',         phone: '(909) 724-8272', schools: ['Elementary', 'Middle'],                    role: 'teacher',   type: 'Teacher' },
  { firstName: 'Matthew',   lastName: 'Carbajal',              phone: '(213) 633-8612', schools: ['Elementary', 'Middle'],                    role: 'teacher',   type: 'Teacher', title: 'ES-MS PE Teacher' },
  { firstName: 'Alyssa',    lastName: 'Diaz',                  phone: '(949) 330-9085', schools: ['Elementary'],                              role: 'teacher',   type: 'Teacher' },
  { firstName: 'Jessica',   lastName: 'Foster',                phone: '(909) 630-9346', schools: ['Elementary'],                              role: 'teacher',   type: 'Teacher' },
  { firstName: 'Sara',      lastName: 'Gaylord',               phone: '(714) 606-8677', schools: ['Elementary', 'Middle'],                    role: 'principal', type: 'Admin',   title: 'Vice Principal' },
  { firstName: 'Luke',      lastName: 'James',                 phone: '(909) 512-2003', schools: ['Elementary', 'Middle', 'High', 'Preschool', 'SCS'], role: 'teacher', type: 'Teacher' },
  { firstName: 'Juhun',     lastName: 'Kim',                   phone: '(323) 393-7926', schools: ['Elementary', 'Middle'],                    role: 'teacher',   type: 'Teacher' },
  { firstName: 'Michael',   lastName: 'Kubasek',               phone: '(714) 341-1631', schools: ['Elementary'],                              role: 'teacher',   type: 'Teacher' },
  { firstName: 'Xally',     lastName: 'Montelongo Rodriguez',  phone: '(626) 321-3156', schools: ['Elementary'],                              role: 'teacher',   type: 'Teacher' },
  { firstName: 'Debbie',    lastName: 'Ryu',                   phone: '(213) 604-0910', schools: ['Elementary'],                              role: 'teacher',   type: 'Teacher' },
  { firstName: 'Emilie',    lastName: 'Saucy',                 phone: '(562) 242-9951', schools: ['Elementary'],                              role: 'teacher',   type: 'Teacher' },
  { firstName: 'Michelle',  lastName: 'Silva',                 phone: '(562) 688-9501', schools: ['Elementary'],                              role: 'teacher',   type: 'Teacher' },
  { firstName: 'Audrey',    lastName: 'Stith',                 phone: '(714) 732-0255', schools: ['Elementary'],                              role: 'teacher',   type: 'Teacher' },
  { firstName: 'Alicia',    lastName: 'Sturm',                 phone: '(714) 686-4704', schools: ['Elementary'],                              role: 'teacher',   type: 'Teacher' },
  { firstName: 'Heayun',    lastName: 'Surh',                  phone: '(949) 233-7554', schools: ['Elementary'],                              role: 'teacher',   type: 'Teacher' },
  { firstName: 'Tiffany',   lastName: 'Wong',                  phone: '(949) 981-8243', schools: ['Elementary'],                              role: 'teacher',   type: 'Teacher' },

  // ── High School ─────────────────────────────────────────────────────────────
  { firstName: 'Aaron',     lastName: 'Burke',                 phone: '(626) 484-7217', schools: ['High'],                                    role: 'teacher',   type: 'Teacher' },
  { firstName: 'Sarah',     lastName: 'Cheah',                 phone: '(562) 458-3720', schools: ['High'],                                    role: 'teacher',   type: 'Teacher' },
  { firstName: 'Patrick',   lastName: 'Haynie',                phone: '(909) 559-4357', schools: ['High'],                                    role: 'teacher',   type: 'Teacher' },
  { firstName: 'Sara',      lastName: 'Hoffman',               phone: '(909) 709-1969', schools: ['High'],                                    role: 'teacher',   type: 'Teacher' },
  { firstName: 'Johnson',   lastName: 'Huang',                 phone: '(626) 429-8785', schools: ['High'],                                    role: 'teacher',   type: 'Teacher' },
  { firstName: 'Donna',     lastName: 'Jaramillo',             phone: '(714) 333-3086', schools: ['High'],                                    role: 'teacher',   type: 'Teacher' },
  { firstName: 'Bryan',     lastName: 'Krause',                phone: '(714) 745-3716', schools: ['High'],                                    role: 'teacher',   type: 'Teacher' },
  { firstName: 'Evangeline',lastName: 'Kwan',                  phone: '(626) 246-8366', schools: ['High'],                                    role: 'teacher',   type: 'Teacher' },
  { firstName: 'Tatsumi',   lastName: 'Lee',                   phone: '(714) 504-8419', schools: ['High'],                                    role: 'teacher',   type: 'Teacher' },
  { firstName: 'Cristine',  lastName: 'Mallari',               phone: '(970) 520-8445', schools: ['High'],                                    role: 'teacher',   type: 'Teacher' },
  { firstName: 'Angela',    lastName: 'Naito',                 phone: '(949) 528-7893', schools: ['High'],                                    role: 'teacher',   type: 'Teacher' },
  { firstName: 'Nicole',    lastName: 'Perkins',               phone: '(909) 631-3255', schools: ['High'],                                    role: 'teacher',   type: 'Teacher', title: 'Long-Term Sub' },
  { firstName: 'Ernesto',   lastName: 'Prieto',                phone: '(909) 229-6221', schools: ['High'],                                    role: 'teacher',   type: 'Teacher' },
  { firstName: 'Danielle',  lastName: 'Schum',                 phone: '(808) 852-8958', schools: ['High'],                                    role: 'teacher',   type: 'Teacher' },
  { firstName: 'Jeffrey',   lastName: 'Seinfeld',              phone: '(310) 402-1346', schools: ['High'],                                    role: 'teacher',   type: 'Teacher' },
  { firstName: 'Lawrence',  lastName: 'Tucker',                phone: '(909) 680-9458', schools: ['High'],                                    role: 'teacher',   type: 'Teacher' },
  { firstName: 'Shannon',   lastName: 'Wongso',                phone: '(909) 413-7119', schools: ['High'],                                    role: 'teacher',   type: 'Teacher' },

  // ── Middle School (itinerant staff already listed above) ────────────────────
  { firstName: 'David',     lastName: 'Cronk',                 phone: '(626) 243-8831', schools: ['Middle'],                                  role: 'teacher',   type: 'Teacher' },
  { firstName: 'Rachel',    lastName: 'Harvey',                phone: '(909) 706-9130', schools: ['Middle'],                                  role: 'teacher',   type: 'Teacher' },
  { firstName: 'Esther',    lastName: 'Lee',                   phone: '(909) 434-4801', schools: ['Middle'],                                  role: 'teacher',   type: 'Teacher' },
  { firstName: 'Hailey',    lastName: 'Manliguis',             phone: '(714) 932-1515', schools: ['Middle'],                                  role: 'teacher',   type: 'Teacher' },
  { firstName: 'Miguel',    lastName: 'Medina',                phone: '(909) 576-0836', schools: ['Middle'],                                  role: 'teacher',   type: 'Teacher' },
  { firstName: 'Esther',    lastName: 'Wesley',                phone: '(714) 580-9704', schools: ['Middle'],                                  role: 'teacher',   type: 'Teacher' },

  // ── Southlands Christian School (main campus) ────────────────────────────────
  { firstName: 'Nicole',    lastName: 'Baldomino',             phone: '(626) 899-6821', schools: ['SCS'],                                     role: 'admin',     type: 'Admin',   title: 'Director of Student Services' },
]

// ─── Email generator ──────────────────────────────────────────────────────────

/** Turns (Luz, Avila) → lavila@southlandscs.com — matches Southlands email convention */
function makeEmail(firstName: string, lastName: string): string {
  const initial = firstName[0].toLowerCase()
  const last = lastName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '')
  return `${initial}${last}@southlandscs.com`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seedTeachers() {
  console.log('🌱 Loading Southlands staff into database...\n')

  // Get the Southlands organization
  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.slug, 'southlands'),
  })
  if (!org) throw new Error('Southlands organization not found — run npm run db:seed first')

  // Get all 5 schools, indexed by name for easy lookup
  const allSchools = await db
    .select()
    .from(schema.schools)
    .where(eq(schema.schools.organizationId, org.id))

  const schoolByName: Record<string, typeof allSchools[0]> = {}
  for (const s of allSchools) schoolByName[s.name] = s

  let usersCreated = 0
  let usersSkipped = 0
  let employeeRecords = 0

  for (const person of STAFF) {
    const email = makeEmail(person.firstName, person.lastName)

    // Check if this person already has a user record (safe to run twice)
    const existing = await db.query.users.findFirst({
      where: eq(schema.users.email, email),
    })

    let userId: string

    if (existing) {
      userId = existing.id
      usersSkipped++
    } else {
      // Primary school = first in their list
      const primarySchoolName = SCHOOL_KEY_TO_NAME[person.schools[0]]
      const primarySchool = schoolByName[primarySchoolName]

      const [newUser] = await db
        .insert(schema.users)
        .values({
          email,
          firstName: person.firstName,
          lastName: person.lastName,
          phone: person.phone,
          role: person.role,
          organizationId: org.id,
          schoolId: primarySchool?.id ?? null,
        })
        .returning()

      userId = newUser.id
      usersCreated++
    }

    // Create an employee record for each school this person teaches at
    for (const schoolKey of person.schools) {
      const schoolName = SCHOOL_KEY_TO_NAME[schoolKey]
      const school = schoolByName[schoolName]

      if (!school) {
        console.warn(`  ⚠️  School not found: ${schoolName}`)
        continue
      }

      // Don't create duplicates if script is run again
      const existingEmployee = await db.query.employees.findFirst({
        where: and(
          eq(schema.employees.userId, userId),
          eq(schema.employees.schoolId, school.id)
        ),
      })

      if (!existingEmployee) {
        await db.insert(schema.employees).values({
          userId,
          schoolId: school.id,
          employeeType: person.type,
        })
        employeeRecords++
      }
    }

    const schoolList = person.schools.join(', ')
    const tag = usersSkipped > usersCreated + usersSkipped - 1 ? '(already existed)' : '✓ created'
    console.log(`  ${existing ? '→ skipped' : '✓ added  '} ${person.firstName} ${person.lastName} [${schoolList}]`)
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Users created:   ${usersCreated}`)
  console.log(`   Users skipped:   ${usersSkipped} (already in database)`)
  console.log(`   Employee records: ${employeeRecords}`)
  console.log(`\n🎉 Done! ${usersCreated + usersSkipped} staff members ready in SubHub.`)

  await client.end()
}

seedTeachers().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
