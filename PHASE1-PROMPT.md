# Phase 1 Build Prompt for Claude Code

## Project: SubHub — Modern Substitute Teacher Management

You are building a modern web application to replace Frontline Education's Absence Management (formerly Aesop) for K-12 schools. The app manages substitute teacher assignments when teachers are absent.

## What to Build — Phase 1: Foundation

### 1. Initialize Project
Create a Next.js 14+ project in the current directory with:
- App Router
- TypeScript
- Tailwind CSS
- shadcn/ui components (use `npx shadcn@latest init`)

### 2. Install Dependencies
```
npm install @supabase/supabase-js @supabase/ssr drizzle-orm postgres dotenv
npm install -D drizzle-kit
```

### 3. Environment Setup
Create `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=https://klthwrzyyrdgaoemrrhl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_dH8dAQdeAngCw5aNGb7_wA_eM-An3td
```
Also create `.env` for service-side vars (same values).

### 4. Database Schema (Drizzle + PostgreSQL)

Create the schema in `src/db/schema.ts`:

```typescript
// Organizations (school districts)
organizations: {
  id: uuid (primary key, default gen_random_uuid())
  name: text (not null)
  slug: text (unique, not null)
  created_at: timestamp (default now())
  updated_at: timestamp (default now())
}

// Schools (campuses within a district)
schools: {
  id: uuid (pk)
  organization_id: uuid (fk -> organizations)
  name: text (not null)
  address: text
  city: text
  state: text (default 'CA')
  zip: text
  phone: text
  fax: text
  timezone: text (default 'America/Los_Angeles')
  day_start_time: time (default '07:30')
  day_end_time: time (default '15:30')
  created_at: timestamp
  updated_at: timestamp
}

// Users (all people in the system)
users: {
  id: uuid (pk) — this maps to Supabase auth.users.id
  email: text (unique, not null)
  first_name: text (not null)
  last_name: text (not null)
  phone: text
  role: text (not null) — 'admin' | 'principal' | 'teacher' | 'substitute'
  organization_id: uuid (fk -> organizations, not null)
  school_id: uuid (fk -> schools, nullable — admins may span schools)
  status: text (default 'active') — 'active' | 'inactive'
  avatar_url: text
  created_at: timestamp
  updated_at: timestamp
}

// Employees (teachers and staff who can be absent)
employees: {
  id: uuid (pk)
  user_id: uuid (fk -> users, unique)
  school_id: uuid (fk -> schools)
  employee_type: text (default 'Teacher') — 'Teacher' | 'Staff' | 'Admin'
  status: text (default 'active') — 'active' | 'inactive'
}

// Substitutes
substitutes: {
  id: uuid (pk)
  user_id: uuid (fk -> users, unique)
  status: text (default 'active') — 'active' | 'inactive'
  skills: jsonb (default '[]') — array of {name, expires_at}
  rating: numeric(3,2) (default 0)
  rating_count: integer (default 0)
  preferred_at_schools: jsonb (default '[]') — array of school_ids with order
  excluded_from_schools: jsonb (default '[]') — array of school_ids
}

// Absence Reasons (per organization)
absence_reasons: {
  id: uuid (pk)
  organization_id: uuid (fk -> organizations)
  name: text (not null) — e.g. 'Sick Day', 'Personal Day', 'Bereavement'
  is_default: boolean (default false)
  sort_order: integer (default 0)
}

// KEY FEATURE: Decoupled Teacher Time-Off and Sub Working Hours

// Teacher Time-Off Records (when a teacher is absent)
teacher_time_off: {
  id: uuid (pk)
  organization_id: uuid (fk -> organizations)
  school_id: uuid (fk -> schools)
  employee_id: uuid (fk -> employees)
  date: date (not null)
  start_time: time (not null)
  end_time: time (not null)
  reason_id: uuid (fk -> absence_reasons)
  notes_to_admin: text
  notes_to_sub: text
  admin_only_notes: text
  approval_status: text (default 'unapproved') — 'unapproved' | 'approved' | 'denied' | 'partially_approved'
  approved_by: uuid (fk -> users, nullable)
  approved_at: timestamp (nullable)
  reconciliation_status: text (default 'unreconciled') — 'unreconciled' | 'reconciled'
  substitute_required: boolean (default true)
  hold_until: text (default 'no_hold') — various hold options
  accounting_code: text
  pay_code: text
  created_at: timestamp
  updated_at: timestamp
}

// Sub Assignments (who covers what — separate from teacher time-off)
sub_assignments: {
  id: uuid (pk)
  organization_id: uuid (fk -> organizations)
  school_id: uuid (fk -> schools)
  substitute_id: uuid (fk -> substitutes)
  date: date (not null)
  start_time: time (not null)
  end_time: time (not null)
  teacher_time_off_ids: uuid[] (array — ONE sub can cover MULTIPLE teacher gaps)
  total_hours: numeric(4,2)
  status: text (default 'assigned') — 'assigned' | 'confirmed' | 'completed' | 'cancelled'
  sub_feedback_rating: integer (nullable, 1-5)
  sub_feedback_notes: text (nullable)
  confirmed_at: timestamp (nullable)
  created_at: timestamp
  updated_at: timestamp
}

// File Attachments (for sub plans, notes, etc.)
attachments: {
  id: uuid (pk)
  organization_id: uuid (fk -> organizations)
  teacher_time_off_id: uuid (fk -> teacher_time_off, nullable)
  sub_assignment_id: uuid (fk -> sub_assignments, nullable)
  uploaded_by: uuid (fk -> users)
  file_name: text (not null)
  file_type: text — 'pdf' | 'image' | 'audio' | 'doc' | 'other'
  file_url: text (not null)
  file_size: integer
  created_at: timestamp
}
```

Generate the Drizzle migration and run it against Supabase.

### 5. Supabase Client Setup
Create `src/lib/supabase/client.ts` (browser) and `src/lib/supabase/server.ts` (server-side) following the Supabase SSR pattern for Next.js App Router.

### 6. Auth
- Sign in page at `/auth/login` with email/password
- Sign up page at `/auth/signup` (admin-only for now — no public registration)
- Protected routes middleware
- After login, redirect to `/dashboard`

### 7. Layout Shell
- Left sidebar with navigation:
  - Dashboard
  - Daily Report
  - Create Absence
  - Find Substitute
  - Absences (submenu: Create Absence, Approve, Reconcile)
  - Reports
  - Settings
  - (Use shadcn/ui sidebar pattern)
- Top bar with: App name, org name, search, user menu, notifications bell
- Responsive (sidebar collapses on mobile)
- Clean, modern design — think Linear/Vercel dashboard aesthetic

### 8. Seed Script
Create `src/db/seed.ts` that populates:
- Organization: Southlands Christian Schools (slug: southlands)
- 5 Schools: High School, Middle School, Elementary School, Preschool, Southlands Christian School
- Absence Reasons: Sick Day, Personal Day, Bereavement, Coaching Duties, Field Trip Coverage, Leave of Absence, Professional Development, Unpaid Absence, Unpaid Vacation
- Sample admin user (jessegentile@gmail.com, role: principal, school: High School)
- 3 sample teachers
- 2 sample substitutes

### 9. Dashboard Page (`/dashboard`)
- Summary cards: Total Absences Today, Unfilled, Filled, No Sub Required
- Quick Actions: Create Absence button, Approve (with count badge), Reconcile
- Unfilled absences table (empty for now, but columns ready)
- Date picker (today default)

### Important Notes
- This is a MULTI-TENANT app from day one — every query must be scoped by organization_id
- The decoupled hours model (teacher_time_off + sub_assignments as separate tables) is the KEY architectural differentiator
- Use shadcn/ui components throughout — no custom UI from scratch
- Keep it clean and minimal — this is the foundation, not the finished product
- All files should be in `src/` directory