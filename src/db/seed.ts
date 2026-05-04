/**
 * Database seed script — populates the database with initial data for Southlands Christian Schools.
 * 
 * This creates the real organization, schools, and a few sample users so the app
 * isn't empty when you first log in. You can run it with: npm run db:seed
 * 
 * What it creates:
 * - Organization: Southlands Christian Schools
 * - 5 Schools: High School, Middle School, Elementary, Preschool, SCS (main campus)
 * - Absence reasons matching Frontline's setup
 * - 1 admin user (jessegentile@gmail.com) — you
 * - 3 sample teachers
 * - 2 sample substitutes
 */

import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { eq } from 'drizzle-orm';

// Use direct connection for seeding (more reliable for long scripts)
const connectionString = process.env.DATABASE_URL_DIRECT!;
const client = postgres(connectionString, { ssl: { rejectUnauthorized: false } });
const db = drizzle(client, { schema });

// Supabase admin client for auth (creates user accounts)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Create the organization
  const [org] = await db.insert(schema.organizations).values({
    name: 'Southlands Christian Schools',
    slug: 'southlands',
  }).returning();
  console.log(`✅ Created organization: ${org.name} (${org.id})`);

  // 2. Create the 5 schools
  const schools = await db.insert(schema.schools).values([
    { organizationId: org.id, name: 'Southlands Christian High School', address: '2130 E Santa Gertrudis Ave', city: 'Brea', state: 'CA', zip: '92821', phone: '(714) 528-3480', dayStartTime: '07:30', dayEndTime: '15:30' },
    { organizationId: org.id, name: 'Southlands Christian Middle School', address: '2130 E Santa Gertrudis Ave', city: 'Brea', state: 'CA', zip: '92821', phone: '(714) 528-3480', dayStartTime: '07:45', dayEndTime: '15:15' },
    { organizationId: org.id, name: 'Southlands Christian Elementary School', address: '2130 E Santa Gertrudis Ave', city: 'Brea', state: 'CA', zip: '92821', phone: '(714) 528-3480', dayStartTime: '08:00', dayEndTime: '15:00' },
    { organizationId: org.id, name: 'Southlands Christian Preschool', address: '2130 E Santa Gertrudis Ave', city: 'Brea', state: 'CA', zip: '92821', phone: '(714) 528-3480', dayStartTime: '08:30', dayEndTime: '14:30' },
    { organizationId: org.id, name: 'Southlands Christian School', address: '2130 E Santa Gertrudis Ave', city: 'Brea', state: 'CA', zip: '92821', phone: '(714) 528-3480', dayStartTime: '08:00', dayEndTime: '15:00' },
  ]).returning();
  console.log(`✅ Created ${schools.length} schools`);

  const hs = schools[0]; // High School

  // 3. Create absence reasons
  const reasons = await db.insert(schema.absenceReasons).values([
    { organizationId: org.id, name: 'Sick Day', isDefault: true, sortOrder: 1 },
    { organizationId: org.id, name: 'Personal Day', isDefault: false, sortOrder: 2 },
    { organizationId: org.id, name: 'Bereavement', isDefault: false, sortOrder: 3 },
    { organizationId: org.id, name: 'Coaching Duties', isDefault: false, sortOrder: 4 },
    { organizationId: org.id, name: 'Field Trip Coverage', isDefault: false, sortOrder: 5 },
    { organizationId: org.id, name: 'Leave of Absence', isDefault: false, sortOrder: 6 },
    { organizationId: org.id, name: 'Professional Development', isDefault: false, sortOrder: 7 },
    { organizationId: org.id, name: 'Unpaid Absence', isDefault: false, sortOrder: 8 },
    { organizationId: org.id, name: 'Unpaid Vacation', isDefault: false, sortOrder: 9 },
  ]).returning();
  console.log(`✅ Created ${reasons.length} absence reasons`);

  // 4. Create admin user (Jesse) via Supabase Auth
  const { data: adminAuth, error: adminError } = await supabase.auth.admin.createUser({
    email: 'jessegentile@gmail.com',
    password: 'SubHub2026!',
    email_confirm: true,
  });
  if (adminError) {
    console.error('❌ Failed to create admin auth user:', adminError);
  } else {
    // Insert into our users table
    await db.insert(schema.users).values({
      id: adminAuth.user!.id,
      email: 'jessegentile@gmail.com',
      firstName: 'Jesse',
      lastName: 'Gentile',
      phone: '(714) 555-0100',
      role: 'principal',
      organizationId: org.id,
      schoolId: hs.id,
    });
    // Also create employee record
    const [adminUser] = await db.select().from(schema.users).where(eq(schema.users.email, 'jessegentile@gmail.com')).limit(1);
    if (adminUser) {
      await db.insert(schema.employees).values({
        userId: adminUser.id,
        schoolId: hs.id,
        employeeType: 'Admin',
      });
    }
    console.log('✅ Created admin user: jessegentile@gmail.com (password: SubHub2026!)');
  }

  // 5. Create sample teachers
  const teacherEmails = [
    { email: 'sarah.johnson@school.test', firstName: 'Sarah', lastName: 'Johnson' },
    { email: 'michael.chen@school.test', firstName: 'Michael', lastName: 'Chen' },
    { email: 'emily.roberts@school.test', firstName: 'Emily', lastName: 'Roberts' },
  ];

  for (const t of teacherEmails) {
    const { data: authData } = await supabase.auth.admin.createUser({
      email: t.email,
      password: 'Teacher2026!',
      email_confirm: true,
    });
    if (authData?.user) {
      await db.insert(schema.users).values({
        id: authData.user.id,
        email: t.email,
        firstName: t.firstName,
        lastName: t.lastName,
        role: 'teacher',
        organizationId: org.id,
        schoolId: hs.id,
      });
      const [teacher] = await db.select().from(schema.users).where(eq(schema.users.email, t.email)).limit(1);
      if (teacher) {
        await db.insert(schema.employees).values({
          userId: teacher.id,
          schoolId: hs.id,
          employeeType: 'Teacher',
        });
      }
    }
  }
  console.log('✅ Created 3 sample teachers');

  // 6. Create sample substitutes
  const subEmails = [
    { email: 'gary.surdam@sub.test', firstName: 'Gary', lastName: 'Surdam' },
    { email: 'maria.garcia@sub.test', firstName: 'Maria', lastName: 'Garcia' },
  ];

  for (const s of subEmails) {
    const { data: authData } = await supabase.auth.admin.createUser({
      email: s.email,
      password: 'Sub2026!',
      email_confirm: true,
    });
    if (authData?.user) {
      await db.insert(schema.users).values({
        id: authData.user.id,
        email: s.email,
        firstName: s.firstName,
        lastName: s.lastName,
        phone: '(714) 555-0200',
        role: 'substitute',
        organizationId: org.id,
        schoolId: hs.id,
      });
      const [sub] = await db.select().from(schema.users).where(eq(schema.users.email, s.email)).limit(1);
      if (sub) {
        await db.insert(schema.substitutes).values({
          userId: sub.id,
          skills: [{ name: 'Teacher - Must Have', expires_at: null }],
          rating: '4.83',
          ratingCount: 18,
          preferredAtSchools: [hs.id],
          excludedFromSchools: [],
        });
      }
    }
  }
  console.log('✅ Created 2 sample substitutes');

  console.log('\n🎉 Seeding complete!');
  console.log('📧 Admin login: jessegentile@gmail.com / SubHub2026!');
  console.log('📧 Teacher login: sarah.johnson@school.test / Teacher2026!');
  console.log('📧 Sub login: gary.surdam@sub.test / Sub2026!');

  await client.end();
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});