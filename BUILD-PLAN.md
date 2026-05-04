# SubHub — Build Plan (Phased MVP)

**Product:** Modern substitute teacher management for K-12 schools  
**Competitor:** Frontline Absence Management (formerly Aesop)  
**Feature Map:** See `frontline-feature-map.md` in parent directory  
**Approach:** Build in layers, each phase delivers a working product

---

## Phase 1: Foundation (Week 1)
**Goal:** Working auth, database, and basic UI shell

### 1.1 Project Setup
- [ ] Initialize Next.js 14+ project (App Router)
- [ ] TypeScript, Tailwind CSS, shadcn/ui components
- [ ] PostgreSQL database (Supabase or Neon)
- [ ] Drizzle ORM for schema + migrations
- [ ] NextAuth.js for authentication (email + Google OAuth)
- [ ] Deploy to Vercel

### 1.2 Database Schema — Core Tables
```
organizations    → id, name, slug, settings
schools          → id, organization_id, name, address, phone, timezone, day_schedule
users            → id, email, name, role (admin|principal|teacher|substitute), phone, organization_id, school_id
employees        → id, user_id, school_id, employee_type, status (active|inactive)
substitutes      → id, user_id, status, skills[], rating, response_count
absence_reasons  → id, organization_id, name, is_default
```

### 1.3 Auth & Roles
- [ ] Login page (email/password + Google SSO)
- [ ] Role-based access: Admin, Principal, Teacher, Substitute
- [ ] Organization/school scoping
- [ ] Basic layout shell (sidebar, topbar, responsive)

### 1.4 Seed Data
- [ ] Southlands Christian Schools (as test org)
- [ ] 5 schools (HS, MS, Elem, PS, SCS)
- [ ] Sample employees, substitutes, absence reasons

**Deliverable:** Empty app you can log into, with database ready

---

## Phase 2: Core CRUD (Week 2)
**Goal:** Create and view absences — the daily workflow

### 2.1 Dashboard
- [ ] Daily summary: total absences, filled, unfilled, no sub required
- [ ] Quick actions: Create Absence, Approve (count badge), Reconcile
- [ ] Unfilled absences table with confirmation #, name, school, reason
- [ ] Date picker (today default, prev/next)
- [ ] Filter by school, employee type

### 2.2 Create Absence (Simplified — 2 steps, not 4)
**Step 1: Select Employee + Date**
- [ ] Search employee by name (instant search, no A-Z browsing)
- [ ] Date picker (click day on calendar, drag for multi-day)
- [ ] Absence reason dropdown
- [ ] Time: Full Day / Half Day AM / Half Day PM / Custom (with times)
- [ ] Substitute Required: Yes/No

**Step 2: Notes & Confirm**
- [ ] Notes to Admin, Notes to Sub, Admin-Only Notes
- [ ] File attachment upload (PDF, DOC, images)
- [ ] Voice recording upload (audio files)
- [ ] Review summary + Create button
- [ ] "Create & Assign Sub" button (jumps to sub assignment)

### 2.3 Absence Detail View
- [ ] View absence with all details
- [ ] Edit absence
- [ ] Delete absence
- [ ] Assign/reassign substitute
- [ ] Reconcile toggle

### 2.4 Approve Absences
- [ ] List of pending approvals with date range filter
- [ ] Status filters: Unapproved, Partially Approved, Approved, Denied
- [ ] Bulk approve/deny with checkboxes
- [ ] Inline approve/deny buttons

**Deliverable:** You can create, view, approve, and manage absences

---

## Phase 3: Sub Management (Week 3)
**Goal:** Substitute profiles, assignment, and the decoupled hours model

### 3.1 Substitute Profiles
- [ ] Substitute list with search/filter
- [ ] Profile: name, phone, email, status, skills, availability
- [ ] Rating display (1-5 stars with count)
- [ ] Preferred/Excluded per school settings
- [ ] Availability calendar (days available, blackout dates)

### 3.2 Decoupled Sub Hours (KILLER FEATURE)
- [ ] Sub Assignment model separate from Absence model
- [ ] One sub can be assigned to multiple absences in a day
- [ ] Sub Working Record: sub_id, date, start_time, end_time, absence_ids[], total_hours
- [ ] Teacher Time-Off Record: employee_id, date, start_time, end_time, reason, sub_assignment_id (nullable)
- [ ] Visual timeline showing sub coverage across multiple gaps
- [ ] "Smart Stack" suggestion: system proposes which gaps a sub can fill together

### 3.3 Preferred/Excluded Subs per School
- [ ] Drag-to-reorder preferred subs list
- [ ] Call order vs. random toggle
- [ ] Hold Until settings (time windows for preferred access)
- [ ] Excluded subs list

### 3.4 Find Substitute
- [ ] Search by name, skills, availability, school
- [ ] View substitute profile from search results
- [ ] Assign directly to absence

**Deliverable:** Full sub management with the decoupled hours model working

---

## Phase 4: Communication Engine (Week 4)
**Goal:** Twilio SMS outreach — the growth driver

### 4.1 Twilio Setup
- [ ] Twilio account (already have: +1 657 300 6005)
- [ ] Upgrade from trial (A2P 10DLC registration)
- [ ] Webhook endpoints for incoming SMS
- [ ] Message templates (configurable per org)

### 4.2 Automated SMS Outreach
- [ ] Daily unfilled absence scan (cron job)
- [ ] Priority tiers:
  1. Preferred subs (Hold Until window)
  2. Available subs with matching skills
  3. Blast to all available subs
- [ ] SMS with deep link: "Southlands HS needs a sub for Math on May 5, 7:30am-3pm. Accept: https://subhub.app/a/xK9m2"
- [ ] Deep link opens to one-tap accept page (no login required — magic link)
- [ ] Sub can text back "ACCEPT" or "DECLINE"
- [ ] Auto-assign on accept, notify admin, notify teacher

### 4.3 Notifications
- [ ] In-app notification center
- [ ] Email notifications (configurable per user)
- [ ] SMS notifications for urgent events (unfilled absences, cancellations)

**Deliverable:** SMS sub-filling working end-to-end

---

## Phase 5: Reports & Reconciliation (Week 5)
**Goal:** Admin reporting and end-of-day reconciliation

### 5.1 Daily Report
- [ ] Printable daily report (absences by school, period, sub status)
- [ ] Export to PDF
- [ ] Filter by date, school, employee type

### 5.2 Key Reports
- [ ] Absentee Report (by date range, employee, reason)
- [ ] Monthly Summary (by month/year)
- [ ] Substitute Availability (by date, school)
- [ ] Staff List (active/inactive employees)

### 5.3 Reconciliation
- [ ] List of absences needing reconciliation (past date, still unfilled/unconfirmed)
- [ ] Mark as reconciled
- [ ] Bulk reconciliation

### 5.4 Calendar View
- [ ] Monthly calendar with absences color-coded (filled=green, unfilled=red)
- [ ] Click day to see details
- [ ] Drag to create absence on calendar

**Deliverable:** Full reporting suite, calendar view, reconciliation workflow

---

## Phase 6: Integrations & Onboarding (Week 6)
**Goal:** ADP integration, bulk import, polish

### 6.1 ADP Workforce Now Integration
- [ ] Research ADP API auth (OAuth 2.0, certificate-based)
- [ ] Map data: sub working hours → ADP timecards
- [ ] Map data: teacher time-off → ADP leave records
- [ ] Scheduled sync (nightly or on-demand)
- [ ] Sync status dashboard (success/failure per record)

### 6.2 Bulk Teacher Import
- [ ] CSV/Excel upload
- [ ] Field mapping UI (drag columns to fields)
- [ ] Preview before import
- [ ] Update existing records on re-import

### 6.3 Rich Sub Plans (Notes/Photos/Voice)
- [ ] Voice recording in-app (Web Audio API, record directly in browser)
- [ ] Photo upload from mobile camera
- [ ] Rich text notes editor
- [ ] Sub sees all materials when viewing assignment

### 6.4 Polish & Mobile
- [ ] PWA (installable on phones)
- [ ] Mobile-optimized views (teacher creates absence from phone)
- [ ] Mobile sub view (accept job, see sub plan, navigate to school)
- [ ] Dark mode

**Deliverable:** Production-ready MVP with integrations

---

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL (Supabase) |
| ORM | Drizzle |
| Auth | Supabase Auth (email + Google OAuth, row-level security) |
| File Storage | Supabase Storage |
| SMS | Twilio (+1 657 300 6005, upgrade to production) |
| Payments | Stripe (future) |
| Email | SendGrid or Resend |
| Hosting | Vercel (frontend/API) + Supabase (database/auth/storage) |
| Payroll API | ADP Workforce Now |
| Voice Recording | Web Audio API + FFmpeg for processing |

## Database Architecture

**Scale target:** Several hundred schools, a few thousand teachers/subs (50K-100K users)

**Multi-tenant from day one:**
- All tables scoped by `organization_id` (district level) and `school_id`
- Row-Level Security (RLS) policies in Supabase ensure data isolation
- Organization admins see all their schools; principals see only theirs
- Substitute availability is scoped per-organization

**Why PostgreSQL/Supabase over MySQL (SiteGround):**
- PostgreSQL handles JSON fields natively (skills, custom fields, settings)
- Supabase gives us Auth, RLS, Realtime subscriptions, and Storage for free
- Scales to millions of rows without changing architecture
- Free tier covers the entire MVP and well beyond
- SiteGround MySQL is fine for hosting the marketing site (substitutes.us)

**Hosting strategy:**
- Build and deploy on Vercel + Supabase (modern, scalable)
- Point substitutes.us DNS to Vercel when ready to go live
- SiteGround can still host the marketing site or redirect to the app
- SSH access to SiteGround: ~/.ssh/exchanj_clem, port 18765 (key may need re-authorization)

## Database Naming

Database/API name: **SubHub** (working title - can rebrand later)
Domain: substitutes.us (already owned by Jesse, hosted at SiteGround)

## Key Decisions
- **Decoupled hours model** is the architectural differentiator - build it in from Phase 3
- **SMS-first** sub finding is the growth driver - build it in Phase 4
- **Mobile PWA** - not a native app, keeps costs down, still installable
- **ADP integration** is Phase 6 - important for sales but not day-1 MVP
- **Multi-tenant from day one** - organization_id on every table, RLS in Supabase
- **Supabase over raw Postgres** - free tier includes auth, storage, realtime, and RLS