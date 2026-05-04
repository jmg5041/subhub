# SubHub — Complete Project Package

**Last updated:** May 3, 2026
**Assembled by:** Clem (Jesse's AI assistant)

---

## 📋 Quick Reference

| Item | Value |
|------|-------|
| **App Name** | SubHub |
| **Tagline** | Substitute Teacher Management |
| **Live URL** | https://subhub-theta.vercel.app |
| **GitHub Repo** | https://github.com/jmg5041/subhub (private) |
| **Local Dev** | http://localhost:3333 |
| **Domain** | substitutes.us (owned, DNS at SiteGround) |
| **Current Phase** | Phase 1 Complete — Foundation deployed |

---

## 🔐 All Logins & Credentials

### GitHub
- **URL:** https://github.com/jmg5041/subhub
- **Account:** jessegentile@gmail.com
- **SSH Key:** `~/.ssh/id_ed25519` (ed25519, created May 3 2026)
- **Repo:** private, auto-deploys to Vercel on push to `main`

### Vercel
- **URL:** https://subhub-theta.vercel.app
- **Dashboard:** https://vercel.com/jesse-gentiles-projects/subhub
- **Project ID:** `prj_3XFbmkqyIGQ8RIee45wewiKtLAXe`
- **Team:** Jesse Gentile's projects (Hobby plan)
- **Account:** jessegentile@gmail.com (logged in via GitHub OAuth)
- **Auto-deploy:** Push to `main` branch → auto-deploys in ~60 seconds
- **Framework:** Next.js (auto-detected)
- **Env vars set:**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Supabase (Database + Auth)
- **Dashboard:** https://supabase.com/dashboard
- **Project URL:** https://klthwrzyyrdgaoemrrhl.supabase.co
- **Project Ref:** klthwrzyyrdgaoemrrhl
- **Region:** us-east-1
- **Dashboard Login:** jessegentile@gmail.com (password in `.env.secrets`)
- **DB Password:** See `.env.secrets`

#### API Keys
- **Anon Key & Service Role Key:** See `.env.local` and `.env.secrets` (gitignored for security)
- **Publishable Key:** See `.env.secrets`
- **Secret Key:** See Supabase dashboard

#### Database Connection Strings
- **Transaction Pooler & Direct Connection:** See `.env.local` (gitignored for security)

### SiteGround (substitutes.us hosting)
- **Host:** gcam1060.siteground.biz
- **Port:** 18765
- **User:** u2611-oamblepll6zm
- **SSH Key:** `~/.ssh/exchanj_clem`
- **Server:** Fedora 43, Node.js v22.22.0
- **Web root:** ~/www/substitutes.us/public_html/
- **Marketing site:** Live at https://substitutes.us (static HTML)
- **Note:** SiteGround is for the marketing site only. The app runs on Vercel.

### Twilio (for Phase 4 — SMS)
- **Phone Number:** +1 657 300 6005 (Huntington Beach, CA)
- **Status:** Trial account
- **Limitation:** Needs A2P 10DLC registration for production SMS
- **Credentials:** See `.env.secrets` (not in repo for security)

### Test Logins (seeded in database)
| Role | Email | Password |
|------|-------|----------|
| Admin | jessegentile@gmail.com | See `.env.secrets` |
| Teacher | sarah.johnson@school.test | See `.env.secrets` |
| Substitute | gary.surdam@sub.test | See `.env.secrets` |

---

## 🏗️ Architecture Overview

### Tech Stack
| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 15 (App Router) | Server components, API routes, SSR |
| Language | TypeScript | Type safety across full stack |
| UI | Tailwind CSS + shadcn/ui | Beautiful, accessible components |
| Database | PostgreSQL (Supabase) | Native JSON, RLS, Auth, Storage |
| ORM | Drizzle | Type-safe queries, great DX |
| Auth | Supabase Auth | Built-in RLS, email + Google OAuth |
| SMS | Twilio | 98% open rate for sub outreach |
| Hosting | Vercel | Auto-deploy from GitHub, edge functions |
| Domain | substitutes.us (SiteGround DNS) | Owned by Jesse |

### Database Schema (9 tables)
1. **organizations** — Multi-tenant school districts
2. **schools** — Campuses within a district
3. **users** — All people (admins, teachers, subs)
4. **employees** — Teachers/staff who can be absent
5. **substitutes** — Sub profiles with skills, ratings
6. **absence_reasons** — Per-org absence types (Sick, Personal, etc.)
7. **teacher_time_off** — When a teacher is absent (THE GAP)
8. **sub_assignments** — Who covers what (THE FILL)
9. **assignment_time_off** — Junction table linking them (many-to-many)
10. **attachments** — Files for sub plans, notes, photos

### Key Differentiator: Decoupled Hours Model
In Frontline, one absence = one sub. In SubHub, they're separate:
- `teacher_time_off` = when a teacher is out (the gap)
- `sub_assignments` = who covers what (the fill)
- `assignment_time_off` = links them together

This means ONE substitute can cover MULTIPLE teacher gaps in a day (e.g., periods 1-2 for Mrs. Johnson, periods 3-4 for Mr. Chen). This is SubHub's killer feature.

---

## 📁 Project Structure

```
substitute-app/
├── BUILD-PLAN.md              # 6-phase build plan
├── PHASE1-PROMPT.md           # Phase 1 detailed spec (completed)
├── CLAUDE-CODE-HANDOFF.md    # Handoff doc for Claude Code
├── SUBHUB-COMPLETE-PACKAGE.md # THIS FILE
├── .env.local                 # Supabase keys (gitignored)
├── .env.secrets               # All credentials (gitignored)
├── drizzle.config.ts          # Drizzle ORM config
├── package.json               # Dependencies
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout (fonts, metadata)
│   │   ├── page.tsx            # Home → redirects to dashboard or login
│   │   ├── (app)/              # Authenticated route group
│   │   │   ├── layout.tsx      # Sidebar + topbar layout
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── absences/create/page.tsx    # Placeholder
│   │   │   ├── absences/approve/page.tsx   # Placeholder
│   │   │   ├── absences/reconcile/page.tsx  # Placeholder
│   │   │   ├── substitutes/find/page.tsx    # Placeholder
│   │   │   ├── reports/page.tsx             # Placeholder
│   │   │   └── settings/page.tsx            # Placeholder
│   │   └── auth/
│   │       ├── login/page.tsx    # Email + Google login
│   │       ├── signup/page.tsx   # Registration
│   │       ├── callback/route.ts # OAuth callback handler
│   │       └── layout.tsx        # Auth layout
│   ├── components/
│   │   ├── app-sidebar.tsx       # Navigation sidebar
│   │   ├── layout/               # Sidebar, topbar, mobile sidebar
│   │   └── ui/                   # shadcn/ui components (badge, button, card, etc.)
│   ├── db/
│   │   ├── schema.ts            # Database schema (9 tables + relations)
│   │   ├── seed.ts               # Southlands seed data
│   │   └── index.ts              # Drizzle client connection
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts         # Browser Supabase client
│   │   │   ├── server.ts         # Server Supabase client
│   │   │   ├── admin.ts          # Admin client (bypasses RLS)
│   │   │   └── middleware.ts      # Auth session refresh
│   │   └── utils.ts              # Tailwind merge utility
│   └── middleware.ts             # Next.js auth middleware
```

---

## 🚀 Build Plan (6 Phases)

### Phase 1: Foundation ✅ COMPLETE
- Database schema pushed to Supabase
- Seed data loaded (Southlands org, 5 schools, sample users)
- Auth working (email + Google OAuth)
- Dashboard with stat cards
- All nav pages have placeholders
- Deployed to Vercel

### Phase 2: Core CRUD (Next)
**Create Absence** — 2-step wizard:
1. Select Employee + Date, pick reason, time range, sub required toggle
2. Notes (to admin, to sub, admin-only), attachments, review & submit

**Approve Absences** — Table with filters, bulk approve/deny

**Reconcile Absences** — Past absences needing confirmation

### Phase 3: Sub Management
- Substitute profiles with skills, ratings, availability
- **Decoupled hours model** (the killer feature)
- Preferred/excluded subs per school
- Find & assign subs

### Phase 4: Communication Engine (SMS)
- Twilio SMS outreach for unfilled absences
- Priority tiers (preferred → available → blast)
- Deep link accept page (one-tap, no login)
- In-app + email + SMS notifications

### Phase 5: Reports & Calendar
- Daily, monthly, absentee reports
- Calendar view with color-coded absences
- Export to PDF
- Bulk reconciliation

### Phase 6: Integrations & Polish
- ADP Workforce Now payroll integration (mock data, API framework)
- CSV/Excel bulk import
- Voice recording + photo uploads for sub plans
- PWA (installable on phones)
- Dark mode

---

## 🔄 Deploy Workflow

1. Make code changes locally
2. `cd substitute-app && git add -A && git commit -m "description"`
3. `git push origin main`
4. Vercel auto-deploys in ~60 seconds
5. Live at https://subhub-theta.vercel.app

No manual steps needed after push.

---

## 🌐 DNS & Domain Strategy

**Current state:**
- `substitutes.us` → SiteGround (marketing site, static HTML)
- `subhub-theta.vercel.app` → Vercel (the app)

**Options for going live:**

### Option A: Point substitutes.us to Vercel (recommended)
1. In SiteGround DNS, add CNAME record: `substitutes.us` → `cname.vercel-dns.com`
2. In Vercel, add `substitutes.us` as a custom domain
3. Move marketing site to `www.substitutes.us` or a subdomain
4. Vercel handles SSL automatically

### Option B: Use app.substitutes.us
1. In SiteGround DNS, add CNAME: `app.substitutes.us` → `cname.vercel-dns.com`
2. In Vercel, add `app.substitutes.us` as custom domain
3. Marketing site stays at `substitutes.us`
4. Cleanest separation, no downtime

### Option C: Vercel + SiteGround side by side
1. Keep marketing site at `substitutes.us` (SiteGround)
2. Keep app at `app.substitutes.us` (Vercel)
3. Add "Login" button on marketing site that links to app

---

## 🎯 What to Tell Claude Code

```
Read CLAUDE-CODE-HANDOFF.md in the project root for the full handoff.
The app is a Next.js 14+ app with App Router, TypeScript, Tailwind, shadcn/ui,
and Supabase (auth + database). It's deployed on Vercel and auto-deploys
from GitHub.

Start by reading BUILD-PLAN.md for the full build plan, then work on Phase 2
(Create Absence wizard, Approve Absences, Reconcile). Make sure all code has
clear comments — the owner is a school principal, not a developer.

The database schema is in src/db/schema.ts. The decoupled hours model
(teacher_time_off + sub_assignments as separate tables) is the key differentiator
from Frontline — preserve it.
```

---

## ⚠️ Important Notes

1. **ADP API keys don't exist yet** — costs thousands, schools must approve. Build the integration framework but use mock data.
2. **Twilio is trial** — needs A2P 10DLC registration for production SMS (Phase 4).
3. **Code comments matter** — Jesse is a school principal, not a developer. Every file/function needs clear comments.
4. **Multi-tenant** — `organization_id` on every table, RLS policies in Supabase.
5. **Decoupled hours model** — this is THE differentiator. Don't merge teacher_time_off and sub_assignments.
6. **.env.secrets is gitignored** — never commit secrets to the repo.
7. **Push to deploy** — just push to `main` on GitHub, Vercel auto-deploys.
8. **Scale target** — several hundred schools, a few thousand teachers/subs (50K-100K users total).

---

*Package assembled by Clem on May 3, 2026. Questions? Check the project docs or ask Jesse.*