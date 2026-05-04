# Claude Code — SubHub Build Prompt

## Who You're Building For
Jesse Gentile is a school principal at Southlands Christian Schools. He's not a developer — all code needs clear comments explaining what each file, function, and component does. He thinks in bullet points and values concise communication.

## What You're Building
**SubHub** — a modern substitute teacher management SaaS that replaces Frontline Education's Absence Management (Aesop). Think "Uber for substitute teachers" — schools post absences, subs get notified and accept jobs.

**Live right now:** https://app.substitutes.us (Phase 1 complete — auth, dashboard, database)

## Where to Start
1. Read `SUBHUB-COMPLETE-PACKAGE.md` for all credentials, architecture, and current status
2. Read `BUILD-PLAN.md` for the full 6-phase build plan
3. Read `src/db/schema.ts` for the database schema (9 tables with relations)
4. Read the existing pages in `src/app/(app)/` to understand current code style
5. Continue building Phase 2 (see below)

## Credentials (also in .env.secrets and .env.local)
- **Supabase URL:** https://klthwrzyyrdgaoemrrhl.supabase.co
- **Supabase Anon Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdGh3cnp5eXJkZ2FvZW1ycmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDgzNTYsImV4cCI6MjA5MzQyNDM1Nn0.jCtQjpEYEKUSN0cKKsIcMdszDu_cBwAWT5_RysS7BW4
- **Supabase Service Role Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdGh3cnp5eXJkZ2FvZW1ycmhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg0ODM1NiwiZXhwIjoyMDkzNDI0MzU2fQ.4PmcQHfZBRC7fLRF7nGUy8g_kfLKwQUnBJzSllCNWTM
- **DB Connection:** postgresql://postgres.klthwrzyyrdgaoemrrhl:jdrsYslb1Qa0xKBo@aws-1-us-east-1.pooler.supabase.com:6543/postgres
- **GitHub:** jmg5041/subhub (private, SSH key at ~/.ssh/id_ed25519)
- **Vercel:** Auto-deploys from GitHub `main` branch
- **Admin login:** jessegentile@gmail.com / SubHub2026!
- **Teacher login:** sarah.johnson@school.test / Teacher2026!
- **Sub login:** gary.surdam@sub.test / Sub2026!

## Tech Stack (DO NOT change these)
- **Next.js 15** (App Router, NOT Pages Router)
- **TypeScript** — everything typed
- **Tailwind CSS + shadcn/ui** — for all UI components (add more from shadcn as needed)
- **Supabase** — database, auth, and storage (use existing client files in src/lib/supabase/)
- **Drizzle ORM** — for database queries (schema already defined in src/db/schema.ts)

## Architecture Rules
1. **Multi-tenant from day one** — every table has `organization_id`, use RLS policies
2. **Decoupled hours model** — `teacher_time_off` and `sub_assignments` are SEPARATE tables. This is the killer feature. One sub can cover multiple teacher gaps. NEVER merge them.
3. **Route groups** — `(app)/` wraps all authenticated pages with sidebar layout
4. **Supabase Auth** — use the existing client/server/admin helpers in `src/lib/supabase/`
5. **Server components by default** — only add `"use client"` when you need interactivity
6. **All code must have comments** — Jesse needs to understand what everything does

## What's Already Built (Phase 1 — DO NOT rebuild these)
- ✅ Database schema (9 tables, pushed to Supabase, seeded with Southlands data)
- ✅ Auth (login, signup, Google OAuth, middleware, session refresh)
- ✅ App layout (sidebar navigation, topbar, mobile sidebar)
- ✅ Dashboard page with stat cards and quick actions
- ✅ Placeholder pages for: absences/create, absences/approve, absences/reconcile, substitutes/find, reports, settings
- ✅ Deployed to Vercel at https://app.substitutes.us
- ✅ Auto-deploys from GitHub on push to `main`

## BUILD PHASE 2 — Core CRUD (START HERE)

### 2.1 Create Absence Wizard (PRIORITY #1)
This is the #1 most-used feature. Teachers and admins need to create absences daily.

**Step 1: Select Employee + Date**
- Search employees by name (instant search, type-ahead, NOT A-Z browsing)
- Date picker (single day to start, can add multi-day later)
- Absence reason dropdown (from `absence_reasons` table, scoped to org)
- Time selector: Full Day / Half Day AM / Half Day PM / Custom (with start/end times)
- Substitute Required toggle (Yes/No)
- When "Full Day" selected, auto-fill start/end from school's `day_start_time`/`day_end_time`

**Step 2: Notes & Confirm**
- Notes to Admin (visible to admins only)
- Notes to Sub (visible to assigned sub)
- Admin-Only Notes (never shown to teacher or sub)
- File attachment upload (Supabase Storage)
- Review summary showing all details
- "Create Absence" button → inserts into `teacher_time_off` table
- Optional "Create & Assign Sub" button → creates absence then redirects to sub assignment

### 2.2 Absence Detail View
- Full page showing all absence details
- Edit button (only for unapproved absences)
- Delete button (only for unapproved, with confirmation)
- Assign/reassign substitute section
- Reconciliation section
- Status badges (Unapproved, Approved, Denied)

### 2.3 Approve Absences Page
- Table of pending approvals with columns: Date, Employee, School, Reason, Time, Status
- Date range filter
- Status filter tabs: Unapproved | Partially Approved | Approved | Denied | All
- School filter dropdown
- Bulk approve/deny with checkboxes
- Inline approve/deny buttons per row
- Approving updates `approval_status` and sets `approved_by` and `approved_at`

### 2.4 Absences List Page (NEW — needed before Phase 2 makes sense)
- All absences table with filters (date, school, status, employee)
- Click row → goes to absence detail view
- Quick actions per row (approve, assign sub)

## BUILD PHASE 3 — Sub Management

### 3.1 Substitute Profiles
- List view with search/filter (by name, skills, status, school)
- Profile page: name, phone, email, status, skills tags, availability
- Rating display (1-5 stars with count)
- Assignment history

### 3.2 Find & Assign Substitute
- Search subs by name, skills, availability, school preference
- View sub profile from search results
- Assign directly to absence
- **Decoupled hours**: show sub's existing assignments for that day on a timeline, suggest gaps they can fill
- "Smart Stack" suggestion: system proposes which teacher gaps a sub can cover together

### 3.3 Preferred/Excluded Subs per School
- Drag-to-reorder preferred subs list (or simple up/down arrows)
- Excluded subs list

## BUILD PHASE 4 — Communication Engine (SMS)
- Twilio SMS outreach for unfilled absences
- Priority tiers: preferred subs first → available subs with matching skills → blast to all
- SMS with deep link: one-tap accept page (no login — magic link)
- Sub can text back "ACCEPT" or "DECLINE"
- Auto-assign on accept, notify admin and teacher
- In-app notification center + email notifications

## BUILD PHASE 5 — Reports & Calendar
- Daily report (absences by school, period, sub status), PDF export
- Absentee Report, Monthly Summary, Sub Availability
- Calendar view with color-coded absences
- Bulk reconciliation

## BUILD PHASE 6 — Integrations & Polish
- ADP Workforce Now integration framework (mock data — API keys cost thousands)
- CSV/Excel bulk teacher import with field mapping
- Voice recording + photo uploads for sub plans
- PWA (installable on phones)
- Dark mode

## Deploy Workflow
1. Make code changes
2. `git add -A && git commit -m "descriptive message"`
3. `git push origin main`
4. Vercel auto-deploys in ~60 seconds
5. Live at https://app.substitutes.us

**Important:** Push frequently. Don't batch up 20 changes into one commit. Small, descriptive commits so Jesse can follow along.

## Style Guide
- **Components:** Use shadcn/ui components. If you need a new one, install it: `npx shadcn@latest add [component]`
- **Colors:** Use the existing Tailwind theme (check tailwind.config.ts and globals.css)
- **Layout:** All authenticated pages go in `src/app/(app)/` — they get the sidebar layout automatically
- **Auth pages:** Go in `src/app/auth/` — no sidebar
- **API routes:** Use Next.js Route Handlers in `src/app/api/` when needed
- **Database queries:** Use Drizzle ORM with the existing `db` client from `src/db/index.ts`
- **Supabase queries:** Use the helpers in `src/lib/supabase/` (client for browser, server for server components, admin for bypassing RLS)
- **Comments:** Every file gets a top-level comment explaining what it does. Every function gets a brief comment. Every component gets a comment explaining its purpose.

## Things NOT to Do
- ❌ Don't change the database schema without updating `src/db/schema.ts` AND running `npm run db:push`
- ❌ Don't use Prisma (we use Drizzle)
- ❌ Don't use NextAuth.js (we use Supabase Auth)
- ❌ Don't merge `teacher_time_off` and `sub_assignments` into one table
- ❌ Don't commit `.env.secrets` or `.env.local` to git
- ❌ Don't use `any` types — everything should be properly typed
- ❌ Don't add paid dependencies without checking with Jesse first
- ❌ Don't rebuild what's already working (auth, layout, dashboard)

## Current Seeded Data
- **Organization:** Southlands Christian Schools (id: e7cf3780-0e81-4756-8c05-ea5e1192195e)
- **5 Schools:** HS, MS, Elementary, Preschool, SCS
- **9 Absence Reasons:** Sick Day, Personal Day, Bereavement, Coaching Duties, Field Trip Coverage, Leave of Absence, Professional Development, Unpaid Absence, Unpaid Vacation
- **1 Admin:** Jesse Gentile
- **3 Teachers:** Sarah Johnson, Michael Chen, Emily Roberts
- **2 Subs:** Gary Surdam, Maria Garcia

Use this data for testing — it's already in the database.

---

**Start with Phase 2.1 (Create Absence Wizard). Build it, push it, test it live at app.substitutes.us. Then move to 2.2, 2.3, 2.4. Keep Jesse updated on progress.**