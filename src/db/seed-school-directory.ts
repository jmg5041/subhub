/**
 * Import California public school directory into the school_directory table.
 *
 * Data source: CA Dept of Education "pubschls" TSV download
 * https://www.cde.ca.gov/ds/si/ds/pubschls.asp
 *
 * Usage:
 *   npx tsx src/db/seed-school-directory.ts ./pubschls.txt
 *
 * The file has tab-separated columns with a header row.
 * We skip rows where County = "Out of State" and rows with StatusType = "Closed".
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { db } from './index';
import { schoolDirectory } from './schema';

const FILE_PATH = process.argv[2];
if (!FILE_PATH) {
  console.error('Usage: npx tsx src/db/seed-school-directory.ts <path-to-tsv-file>');
  process.exit(1);
}

// CDE pubschls column headers (as of 2024 download)
// CDSCode, NCESDist, NCESSchool, StatusType, County, District, School, Street, StreetAbr, City, Zip, State, MailStreet, MailStrCity, MailStrZip, MailStrState, Phone, Ext, WebSite, OpenDate, ClosedDate, Charter, CharterNum, FundingType, DOC, DOCType, SOC, SOCType, EdOpsCode, EdOpsName, EILCode, EILName, GSoffered, GSserved, Virtual, Magnet, Latitude, Longitude, AdmFName1, AdmLName1, ...
const COL = {
  CDSCode: 0,
  StatusType: 3,
  County: 4,
  District: 5,
  School: 6,
  Street: 7,
  City: 9,
  Zip: 10,
  State: 11,
  Phone: 16,
  SOCType: 28,   // School type: Public, Private, etc.
  GSoffered: 32, // Grade span offered, e.g. "K-08"
};

async function main() {
  const absPath = path.resolve(FILE_PATH);
  console.log(`Reading from: ${absPath}`);

  const fileStream = fs.createReadStream(absPath, { encoding: 'latin1' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const batch: (typeof schoolDirectory.$inferInsert)[] = [];
  let lineNum = 0;
  let inserted = 0;
  let skipped = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) continue; // skip header

    const cols = line.split('\t');

    const statusType = cols[COL.StatusType]?.trim();
    const county = cols[COL.County]?.trim();

    // Skip closed schools and out-of-state rows
    if (statusType === 'Closed' || county === 'Out of State' || !county) {
      skipped++;
      continue;
    }

    // Skip district-level rows that have no school name
    const schoolName = cols[COL.School]?.trim();
    if (!schoolName || schoolName === '') {
      skipped++;
      continue;
    }

    batch.push({
      cdCode: cols[COL.CDSCode]?.trim() || null,
      districtName: cols[COL.District]?.trim() || null,
      schoolName,
      county,
      city: cols[COL.City]?.trim() || null,
      address: cols[COL.Street]?.trim() || null,
      state: cols[COL.State]?.trim() || 'CA',
      zip: cols[COL.Zip]?.trim()?.slice(0, 5) || null,
      phone: cols[COL.Phone]?.trim() || null,
      schoolType: cols[COL.SOCType]?.trim() || null,
      gradeRange: cols[COL.GSoffered]?.trim() || null,
    });

    // Insert in batches of 500 to avoid huge single queries
    if (batch.length >= 500) {
      await db.insert(schoolDirectory).values(batch).onConflictDoNothing();
      inserted += batch.length;
      batch.length = 0;
      process.stdout.write(`  Inserted ${inserted} rows...\r`);
    }
  }

  // Insert remaining rows
  if (batch.length > 0) {
    await db.insert(schoolDirectory).values(batch).onConflictDoNothing();
    inserted += batch.length;
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
