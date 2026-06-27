# Strategic Context — Jesse Gentile's K-12 SaaS Platform

_Read this first if you're a new Claude Code instance. It explains who Jesse is, what's been
built, what's being built, and where it's all going._

---

## Who Jesse Is

Jesse is a **school principal at Southlands Christian Schools** (Whittier, CA), not a
software developer. He is the first customer of every product described here. He has been
building these products using Claude Code (AI-assisted development) on an M1 Mac. Code is
now also being worked on via a second M3 Mac. Keep code well-commented, avoid unnecessary
abstractions, and explain decisions clearly.

---

## The Three Products

### 1. SubHub — Substitute Teacher Management SaaS
**Status: Live in production. First paying customer is Southlands Christian Schools.**

SubHub replaces Frontline/Aesop for K-12 private schools. When a teacher calls in sick,
SubHub automatically contacts eligible substitutes by SMS, email, and phone call (IVR).
Subs accept or decline with one click — no login required. Admins see everything in real time.

- **Live at:** `https://app.substitutes.us` (Vercel, auto-deploys from `main`)
- **Code:** `/Users/jessegentile/Developer/subhub/`
- **Marketing site:** `https://substitutes.us` (SiteGround static HTML — separate deployment)
- **Supabase project:** `klthwrzyyrdgaoemrrhl`
- **Stack:** Next.js 15 App Router, TypeScript, Tailwind, Supabase, Drizzle ORM, Resend, Twilio, Stripe
- **Price:** $8/teacher/month (with private school discounts available)

**What SubHub does today (feature-complete for first school):**
- Teacher absence portal (mobile, 60-second submit)
- Automated sub blast: SMS + email + phone IVR at 9pm and 6am
- One-click accept/decline from email/SMS links, no login required
- Press-1-to-accept on live phone call (Twilio IVR)
- Admin dashboard with real-time fill status
- Sub priority ordering + school-level pools
- Multi-day absences, lesson plan attachments
- Sub payroll reports + CSV export
- Fill rate analytics
- District/campus/school hierarchy (org → campus → school)
- Platform admin portal for IT staff (dark theme, impersonation, billing controls)
- Stripe billing (live mode, per-teacher seat pricing, webhooks, customer portal)
- 90-day free trial via self-signup at `/auth/signup`
- QStash-based dispatcher for multi-timezone blast scheduling (scales to 1000+ schools)
- Seat management with 48-hour commit window
- Email notifications: welcome, onboarding confirmation, subscription activated, billing alerts

**The CLAUDE.md in this repo** contains exhaustive technical documentation of every system.
Read it. It is authoritative.

---

### 2. Campus Lock — Student Phone Management SaaS
**Status: In development. Pilot school is also Southlands Christian Schools.**

Campus Lock is a multi-tenant SaaS for K-12 private schools that manages student phone
usage during the school day. When a student enters the school campus geofence, distracting
apps are blocked. When they leave, restrictions lift automatically. No MDM required —
students install the app themselves (BYOD).

- **Code:** `/Users/jessegentile/Developer/student-monitor-app/`
- **Also known as:** "student monitor app" in conversation
- **GitHub:** separate repo, can be pushed/pulled to M3 Mac
- **Stack:** React Native + Expo (iOS + Android), Node.js + Fastify backend on Fly.io,
  Next.js 15 admin dashboard on Vercel, Supabase PostgreSQL with RLS, Upstash Redis
- **Auth:** Currently custom RS256 JWT — **planned migration to Supabase Auth** (see Homebase plan)
- **Price:** Per-student-seat pricing (TBD)
- **Competitor:** The Commons (the-commons.app) — "Airplane Mode for Schools"
- **Differentiators:** Geo-attendance + digital hall pass + time-based unlock

**Key technical facts:**
- iOS app blocking: Apple Screen Time API (FamilyControls entitlement APPROVED)
- Android blocking: AccessibilityService + Usage Access
- Real-time presence: Socket.io for admin dashboard
- Student enrollment: CSV import or QR enrollment codes
- Geofence editor: Mapbox GL JS
- Full CLAUDE.md and ARCHITECTURE.md are in the student-monitor-app folder

**Read:** `/Users/jessegentile/Developer/student-monitor-app/CLAUDE.md` for full context.

---

### 3. Homebase — The Shared Platform Vision
**Status: Planned. Architecture documented. No code written yet.**

Homebase is not a third product — it's the **shared infrastructure layer** underneath SubHub
and Campus Lock. The idea: since both products serve the same private K-12 schools, they
should share:
- One org/campus/school hierarchy
- One identity system (users, invitations, Supabase Auth)
- One billing relationship (one Stripe subscription, multiple line items)
- One platform admin portal for IT staff

Schools get one login, one monthly invoice, and one onboarding experience for all products.

**Read:** `HOMEBASE_PLAN.md` in this repo for the full architecture plan (written 2026-06-24).

---

## How the Products Relate

```
HOMEBASE (shared layer)
├── Organizations (schools / districts)
│   ├── Campuses
│   └── Schools
├── Users (admins, principals, staff)
├── Identity (Supabase Auth — one login for all products)
├── Billing (one Stripe subscription, multiple line items)
└── Platform Admin (/platform in SubHub — will expand to cover all products)
    │
    ├── SUBHUB product layer
    │   ├── Teachers (employees table)
    │   ├── Substitutes
    │   ├── Absences + Assignments
    │   └── Notification system (QStash + Twilio)
    │
    └── CAMPUS LOCK product layer
        ├── Students
        ├── Devices + Geofences
        ├── Check-ins / Attendance
        └── Hall Passes
```

**Same pilot school (Southlands) uses both products.** This is why the shared platform
matters — one school, one login, one admin interface.

---

## Current Priorities and Status

### SubHub
- **Deployed and running.** Southlands is in active use.
- Marketing site (`substitutes.us`) was recently redesigned (June 2026) — static HTML,
  deployed via SiteGround SSH.
- Next: grow to additional schools, polish UX, handle billing for new customers.
- Homebase migration work on SubHub (see HOMEBASE_PLAN.md Phases 1–4) is deferred
  until Campus Lock is ready to share the database.

### Campus Lock
- Architecture is fully designed (see student-monitor-app/ARCHITECTURE.md).
- React Native app partially built.
- Apple Screen Time API entitlement is approved.
- Development is moving to the M3 Mac.
- Key open decision: same Next.js repo as SubHub, or separate?

### Homebase
- No code written. Plan exists in `HOMEBASE_PLAN.md`.
- Phase 1 (add `products` + `org_products` tables to SubHub's Supabase) should happen
  before Campus Lock starts writing to the same database.
- Most migration work can be deferred until the first school buys both products.

---

## Key Architectural Decisions Already Made

1. **Single Supabase project** for all products — shared auth is the core value.
2. **Supabase Auth for all products** — Campus Lock's custom JWT will migrate to Supabase Auth.
3. **One Stripe subscription per school, multiple line items** — not separate subscriptions.
4. **Table prefix convention** — Campus Lock tables prefixed `cl_`, SubHub tables keep
   current names (or add `sh_` prefix during cleanup).
5. **No PostgREST queries** — all data goes through Drizzle ORM or Supabase admin client.
   RLS is enabled on all 19+ tables with no policies (deny-all via PostgREST is intentional).
6. **QStash dispatcher pattern** for scheduling — scales to any timezone, any school count.
7. **Platform admin lives in SubHub** (`/platform`) and will expand to cover Campus Lock.

---

## Open Questions (as of June 2026)

1. **Same repo or separate repo for Campus Lock?** SubHub (Vercel/Next.js) vs. a separate
   Next.js repo. This affects routing, deployment, and component sharing.
2. **Parent accounts in Campus Lock** — do parents get Supabase auth accounts (for an app),
   or just contact records (for push notifications only)?
3. **When to start Homebase Phase 1** — before Campus Lock starts writing to the DB,
   or after Campus Lock has its own separate DB?
4. **Campus Lock seat count model** — same 48-hour window as SubHub (designed for slowly
   changing teacher rosters), or a different model better suited for student enrollment?

---

## Repository Map

```
/Users/jessegentile/Developer/
├── subhub/                    ← SubHub Next.js app + this context doc
│   ├── CLAUDE.md              ← Authoritative technical reference (always read this)
│   ├── HOMEBASE_PLAN.md       ← Full Homebase architecture plan
│   ├── STRATEGIC_CONTEXT.md   ← This file
│   └── src/
│       ├── app/
│       │   ├── (app)/         ← Admin/principal/staff portal
│       │   ├── (teacher)/     ← Teacher absence portal
│       │   ├── (sub)/         ← Substitute portal
│       │   ├── (platform)/    ← IT staff platform admin
│       │   ├── (billing)/     ← Billing pages
│       │   ├── (onboarding)/  ← New org onboarding wizard
│       │   └── api/           ← API routes (blast, Stripe, Twilio, cron)
│       ├── db/                ← Drizzle ORM schema + client
│       └── lib/               ← Core utilities (notifications, billing, impersonation)
│
├── student-monitor-app/       ← Campus Lock (student phone management)
│   ├── CLAUDE.md              ← Full technical context for Campus Lock
│   ├── ARCHITECTURE.md        ← System architecture
│   ├── backend/               ← Fastify Node.js API
│   ├── dashboard/             ← Next.js admin dashboard
│   └── mobile/                ← React Native Expo app
│
└── siteground_subhub/         ← substitutes.us marketing site (static HTML)
    ├── index.html             ← The whole site
    ├── privacy.html           ← DO NOT MODIFY (Twilio compliance)
    └── terms.html             ← DO NOT MODIFY (Twilio compliance)
```

---

## Quick Start for a New Session

1. **Read `CLAUDE.md`** in whatever repo you're working in — it's authoritative.
2. **For SubHub work:** the app is live, Southlands is a real customer, be careful with
   database migrations and billing code.
3. **For Campus Lock work:** read `student-monitor-app/CLAUDE.md` and `ARCHITECTURE.md`
   first. The Apple entitlement is approved — don't do anything to risk that.
4. **For Homebase planning:** read `HOMEBASE_PLAN.md`. No code exists yet; all decisions
   are documented there.
5. **Never run `npx drizzle-kit push` in a terminal** — it requires interactive TTY. Generate
   the migration SQL and run it in the Supabase SQL editor instead.
6. **Never touch `privacy.html` or `terms.html`** on the marketing site.
