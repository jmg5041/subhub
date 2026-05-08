/**
 * Import the CDE School Directory into the school_directory table.
 *
 * Source file: CDESchoolDirectoryExport.txt (tab-delimited)
 * Download from: https://www.cde.ca.gov/SchoolDirectory/export
 *
 * Usage:
 *   npx tsx src/db/seed-school-directory.ts ~/Downloads/CDESchoolDirectoryExport.txt
 *
 * Column map (0-indexed, tab-delimited):
 *   0  Record Type       — "School" or "District"; skip non-School rows
 *   1  CDS Code
 *   4  County
 *   5  District
 *   6  School name
 *   7  Status            — "Active" / "Closed" / etc.; skip non-Active
 *  14  Entity Type       — "Elementary School (Private)", "High Schools (Public)", etc.
 *  15  Low Grade         — K, 1, 2, … 12
 *  16  High Grade
 *  26  Street Address
 *  27  Street City
 *  28  Street State
 *  29  Street Zip
 *  34  Phone
 */

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { schoolDirectory } from './schema'

// Load .env.local — Next.js does this automatically but standalone scripts don't
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8')
  for (const line of envFile.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

const connectionString = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL
if (!connectionString) {
  console.error('No DATABASE_URL found in .env.local')
  process.exit(1)
}

const client = postgres(connectionString, { ssl: { rejectUnauthorized: false }, prepare: false })
const db = drizzle(client, { schema })

const FILE_PATH = process.argv[2]
if (!FILE_PATH) {
  console.error('Usage: npx tsx src/db/seed-school-directory.ts <path-to-file>')
  process.exit(1)
}

const COL = {
  recordType:  0,
  cdsCode:     1,
  county:      4,
  district:    5,
  school:      6,
  status:      7,
  entityType:  14,
  lowGrade:    15,
  highGrade:   16,
  lat:         23,
  lng:         24,
  address:     26,
  city:        27,
  state:       28,
  zip:         29,
  phone:       34,
}

async function main() {
  const absPath = path.resolve(FILE_PATH)
  console.log(`Reading: ${absPath}`)

  const fileStream = fs.createReadStream(absPath, { encoding: 'utf8' })
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })

  const batch: (typeof schoolDirectory.$inferInsert)[] = []
  let lineNum = 0
  let inserted = 0
  let skipped = 0

  for await (const line of rl) {
    lineNum++
    if (lineNum === 1) continue // skip header row

    const cols = line.split('\t')

    // Only import active school rows (not districts)
    if (cols[COL.recordType]?.trim() !== 'School') { skipped++; continue }
    if (cols[COL.status]?.trim() !== 'Active')      { skipped++; continue }

    const county     = cols[COL.county]?.trim()
    const schoolName = cols[COL.school]?.trim()
    if (!county || !schoolName) { skipped++; continue }

    const lowGrade  = cols[COL.lowGrade]?.trim()
    const highGrade = cols[COL.highGrade]?.trim()
    const gradeRange = lowGrade && highGrade ? `${lowGrade}-${highGrade}` : (lowGrade || highGrade || null)

    // Zip codes sometimes come as "94502-8006" — keep full zip for accuracy
    const zip = cols[COL.zip]?.trim() || null

    const latRaw = parseFloat(cols[COL.lat]?.trim())
    const lngRaw = parseFloat(cols[COL.lng]?.trim())

    batch.push({
      cdCode:       cols[COL.cdsCode]?.trim()     || null,
      districtName: cols[COL.district]?.trim()    || null,
      schoolName,
      county,
      city:         cols[COL.city]?.trim()        || null,
      address:      cols[COL.address]?.trim()     || null,
      state:        cols[COL.state]?.trim()       || 'CA',
      zip,
      phone:        cols[COL.phone]?.trim()       || null,
      schoolType:   cols[COL.entityType]?.trim()  || null,
      gradeRange,
      lat:          isNaN(latRaw) ? null : String(latRaw),
      lng:          isNaN(lngRaw) ? null : String(lngRaw),
    })

    if (batch.length >= 100) {
      try {
        await db.insert(schoolDirectory).values(batch).onConflictDoNothing()
        inserted += batch.length
        batch.length = 0
        process.stdout.write(`  Inserted ${inserted} rows...\r`)
      } catch (err: unknown) {
        console.error(`\nInsert failed at row ${lineNum}:`)
        console.error(JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2))
        process.exit(1)
      }
    }
  }

  if (batch.length > 0) {
    try {
      await db.insert(schoolDirectory).values(batch).onConflictDoNothing()
      inserted += batch.length
    } catch (err: unknown) {
      const cause = (err as { cause?: Error })?.cause
      const msg = cause ? cause.message : (err instanceof Error ? err.message : String(err))
      console.error(`\nFinal batch insert failed:`, msg)
      process.exit(1)
    }
  }

  console.log(`\nDone. Inserted: ${inserted}  Skipped: ${skipped}`)
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
