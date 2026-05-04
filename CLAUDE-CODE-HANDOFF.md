# SubHub — Claude Code Handoff Package

## Project Overview
SubHub is a modern substitute teacher management SaaS replacing Frontline Education's Absence Management (Aesop). Built for K-12 schools, starting with Southlands Christian Schools.

## Current Status (Phase 1 — Foundation COMPLETE)
The Next.js project is deployed and running at:
- **Vercel (production):** https://subhub-theta.vercel.app
- **Local dev:** http://localhost:3333

The app is live with:
- ✅ Database schema pushed to Supabase (9 tables live)
- ✅ Database seeded with Southlands data
- ✅ Auth system (login, signup, Google OAuth, middleware protection)
- ✅ Dashboard layout with sidebar navigation
- ✅ All nav links have placeholder pages
- ✅ Build compiles cleanly

**What needs to be built next:** Phase 2 (Create Absence wizard, Approve, Reconcile) and beyond.

## Deployment

### Vercel (PRODUCTION — Live ✅)
- **URL:** https://subhub-theta.vercel.app
- **GitHub repo:** https://github.com/jmg5041/subhub (private)
- **Env vars set:** NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- **Auto-deploys:** Push to `main` branch on GitHub → Vercel auto-deploys
- **SSH key for GitHub:** `~/.ssh/id_ed25519` (ed25519, added May 3 2026)

### SiteGround (Marketing Site + Domain)
- **Domain:** substitutes.us (DNS at SiteGround)
- **Marketing site:** Already live at substitutes.us (static HTML in public_html/)
- **SSH Host:** gcam1060.siteground.biz
- **SSH Port:** 18765
- **SSH User:** u2611-oamblepll6zm
- **SSH Key:** `~/.ssh/exchanj_clem`
- **Server:** Fedora 43, Node.js v22.22.0
- **Web root:** ~/www/substitutes.us/public_html/

### DNS Consideration
Currently substitutes.us points to SiteGround (marketing site). To point the domain to Vercel instead, update DNS at SiteGround:
- Option A: Point substitutes.us to Vercel, move marketing site to a subdomain (e.g., www.substitutes.us)
- Option B: Use app.substitutes.us for the SubHub app on Vercel, keep substitutes.us for marketing

## Supabase Credentials (Production Database)
- **Project URL:** https://klthwrzyyrdgaoemrrhl.supabase.co
- **Project Ref:** klthwrzyyrdgaoemrrhl
- **Region:** us-east-1

### API Keys
- **Anon/Publishable Key (safe for browser):**
  ```
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdGh3cnp5eXJkZ2FvZW1ycmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDgzNTYsImV4cCI6MjA5MzQyNDM1Nn0.jCtQjpEYEKUSN0cKKsIcMdszDu_cBwAWT5_RysS7BW4
  ```
- **New Publishable Key:** `sb_publishable_dH8dAQdeAngCw5aNGb7_wA_eM-An3td`
- **Service Role Key (server-only, bypasses RLS):**
  ```
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdGh3cnp5eXJkZ2FvZW1ycmhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg0ODM1NiwiZXhwIjoyMDkzNDI0MzU2fQ.4PmcQHfZBRC7fLRF7nGUy8g_kfLKwQUnBJzSllCNWTM
  ```
- **Secret Key (new format, partially visible):** `sb_secret_bcyBt...`

### Database Connection Strings
- **Transaction Pooler (for app queries):**
  ```
  postgresql://postgres.klthwrzyyrdgaoemrrhl:jdrsYslb1Qa0xKBo@aws-1-us-east-1.pooler.supabase.com:6543/postgres
  ```
- **Direct Connection (for migrations):**
  ```
  postgresql://postgres:jdrsYslb1Qa0xKBo@db.klthwrzyyrdgaoemrrhl.supabase.co:5432/postgres
  ```
- **Database password (reset 2026-05-03):** `jdrsYslb1Qa0xKBo`

### Supabase Dashboard Login
- **URL:** https://supabase.com/dashboard
- **Email:** jessegentile@gmail.com
- **Password:** H3D3HGkLU1dOpxOx (username: 5041)

## Seeded Data (Already in Database)
- **Organization:** Southlands Christian Schools (slug: southlands)
- **5 Schools:** HS, MS, Elementary, Preschool, SCS
- **9 Absence Reasons:** Sick Day, Personal Day, Bereavement, Coaching Duties, Field Trip Coverage, Leave of Absence, Professional Development, Unpaid Absence, Unpaid Vacation
- **Admin user:** jessegentile@gmail.com / SubHub2026!
- **3 sample teachers:** sarah.johnson@school.test / Teacher2026!, michael.chen@school.test, emily.roberts@school.test
- **2 sample substitutes:** gary.surdam@sub.test / Sub2026!, maria.garcia@sub.test

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL (Supabase) |
| ORM | Drizzle |
| Auth | Supabase Auth (email + Google OAuth) |
| File Storage | Supabase Storage |
| SMS | Twilio (+1 657 300 6005, trial, needs A2P 10DLC) |
| Hosting | SiteGround (substitutes.us) — Jesse wants app deployed here |
| Payroll API | ADP Workforce Now (future, Phase 6) |

## Project File Locations
All source code is in:
```
/Users/jessegentile/.openclaw/workspace/substitute-app/
```

### Key files:
- `BUILD-PLAN.md` — Full 6-phase build plan with database architecture
- `PHASE1-PROMPT.md` — Detailed Phase 1 spec (already completed)
- `frontline-feature-map.md` — Complete feature analysis of Frontline Education's Absence Management
- `.env.local` — Environment variables (Supabase keys, DB URLs)
- `.env.secrets` — All credentials (Supabase, Twilio, SSH, etc.)
- `drizzle.config.ts` — Drizzle ORM configuration
- `src/db/schema.ts` — Database schema (9 tables, all with good comments)
- `src/db/seed.ts` — Seed script with Southlands data
- `src/db/index.ts` — Drizzle client connection
- `src/lib/supabase/client.ts` — Browser-side Supabase client
- `src/lib/supabase/server.ts` — Server-side Supabase client
- `src/lib/supabase/admin.ts` — Admin client (bypasses RLS)
- `src/lib/supabase/middleware.ts` — Auth middleware (refreshes sessions)
- `src/middleware.ts` — Next.js middleware entry point
- `src/app/layout.tsx` — Root layout (fonts, metadata)
- `src/app/page.tsx` — Home page (redirects to dashboard or login)
- `src/app/(app)/layout.tsx` — Authenticated layout (sidebar + top bar)
- `src/app/(app)/dashboard/page.tsx` — Dashboard with stat cards
- `src/app/(app)/absences/create/page.tsx` — Placeholder
- `src/app/(app)/absences/approve/page.tsx` — Placeholder
- `src/app/(app)/absences/reconcile/page.tsx` — Placeholder
- `src/app/(app)/substitutes/find/page.tsx` — Placeholder
- `src/app/(app)/reports/page.tsx` — Placeholder
- `src/app/(app)/settings/page.tsx` — Placeholder
- `src/app/auth/login/page.tsx` — Login page (email + Google)
- `src/app/auth/signup/page.tsx` — Signup page
- `src/app/auth/callback/route.ts` — OAuth callback handler
- `src/components/app-sidebar.tsx` — Sidebar navigation component

## Database Schema (Key Design Decisions)

### Decoupled Hours Model (THE Differentiator)
In Frontline, one absence = one sub. In SubHub, they're separate:
- `teacher_time_off` — when a teacher is absent (the gap)
- `sub_assignments` — who covers what (the fill)
- `assignment_time_off` — junction table linking them

This means ONE substitute can cover MULTIPLE teacher gaps in a day (e.g., periods 1-2 for Mrs. Johnson, periods 3-4 for Mr. Chen).

### Multi-Tenant from Day One
Every table has `organization_id` for data isolation. Row-Level Security (RLS) in Supabase ensures org admins see only their data.

## Build Instructions for SiteGround Deployment

### Option A: Deploy Next.js on SiteGround (Node.js)
1. SSH into SiteGround: `ssh -i ~/.ssh/exchanj_clem -p 18765 user@substitutes.us`
2. Install Node.js 20+ on the server (SiteGround supports Node via cPanel or SSH)
3. Clone the repo or copy files to `~/substitutes.us/`
4. Install dependencies: `npm ci`
5. Build: `npm run build`
6. Start with PM2 or similar process manager: `pm2 start npm --name "subhub" -- start`
7. Configure SiteGround's nginx/Apache to reverse proxy port 3333 → substitutes.us

### Option B: Static Export + SiteGround (if server-rendering isn't needed)
Not recommended — SubHub needs server-side auth and database queries.

### Option C: Vercel + SiteGround DNS (simplest)
1. Push code to GitHub
2. Connect Vercel to the GitHub repo
3. Point substitutes.us DNS to Vercel
4. SiteGround can still host a marketing page on a subdomain

Jesse specifically asked for SiteGround deployment. Try Option A first.

## What to Build Next (Phase 2)

### Create Absence Wizard (4 steps)
1. **Select Teacher** — search by name, see their schedule
2. **Date & Time** — pick date, start/end time, absence reason, hold-until option
3. **Notes** — notes to admin, notes to sub, attachments
4. **Review & Submit** — confirm all details before submitting

### Approve Absences Page
- Table of unapproved absences with filters (school, date range, status)
- Bulk approve/deny actions
- Per-absence approval with admin notes

### Reconcile Absences Page
- List of past absences needing reconciliation
- Confirm sub worked, actual hours, rate the sub

### Settings Page
- Organization info, school day times, absence reasons management
- Preferred/excluded subs per teacher

## Feature Map
Full Frontline feature analysis is in `/Users/jessegentile/.openclaw/workspace/frontline-feature-map.md`

## 5 Differentiating Features (vs Frontline)
1. **Decoupled hours model** — one sub can cover multiple teacher gaps
2. **SMS-first sub finding** — Twilio SMS with deep links (98% open rate)
3. **ADP payroll integration** — push sub hours directly to payroll
4. **PWA, not native app** — installable on phones without app store
5. **Better UX** — modern design, faster, no confusing phone tree

## Important Notes
- **ADP API keys NOT available** — costs thousands, schools must approve. Build the integration framework but use mock data.
- **Twilio is trial** — needs A2P 10DLC registration for production SMS
- **All code has comments** explaining what each file/function does — Jesse requested this
- **Jesse is a school principal** at Southlands Christian Schools, not a developer. Code should be well-documented.
- **Push to deploy:** Just push to `main` on GitHub and Vercel auto-deploys. No manual steps needed.
- **.env.secrets** is in `.gitignore` — never commit secrets to the repo