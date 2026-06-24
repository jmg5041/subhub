# SubHub — Claude Code Guide

SubHub is a substitute teacher management SaaS for K-12 schools, built as a direct
competitor to Frontline/Aesop. The initial customer is Southlands Christian Schools.
The owner (Jesse) is a school principal, not a developer — keep code well-commented
and avoid unnecessary abstractions.

---

## Deployment & Repositories

| Thing | Location |
|-------|----------|
| Code | `/Users/jessegentile/Developer/subhub/` |
| Git repo | `github.com/jmg5041/subhub` (branch: `main`) |
| Production app | `https://app.substitutes.us` (Vercel, auto-deploys on push to `main`) |
| Marketing site | `substitutes.us` (SiteGround static HTML — **separate, do not touch**) |
| Supabase project | project ID `klthwrzyyrdgaoemrrhl` |

**To deploy:** push to `main`. Vercel picks it up automatically.
**To run locally:** `npm run dev` — requires `.env.local` (see Environment Variables below).

---

## Tech Stack

| Layer | Tool | Version |
|-------|------|---------|
| Framework | Next.js App Router | 15 |
| Language | TypeScript | — |
| Styling | Tailwind CSS | — |
| UI components | shadcn/ui + lucide-react icons | — |
| Database | Supabase (Postgres) | — |
| ORM | Drizzle ORM | 0.45 |
| Auth | Supabase Auth | — |
| Email | Resend | — |
| SMS / Voice IVR | Twilio | — |
| File storage | Supabase Storage | — |
| Hosting | Vercel | — |

---

## User Roles & Portals

There are five roles. Each role lands in a different section of the app.

| Role | Where they go | Route group | Layout file |
|------|--------------|-------------|-------------|
| `admin` | `/dashboard` | `(app)` | `src/app/(app)/layout.tsx` |
| `principal` | `/dashboard` | `(app)` | same |
| `staff` | `/dashboard` | `(app)` | same |
| `teacher` | `/teacher` | `(teacher)` | `src/app/(teacher)/layout.tsx` |
| `substitute` | `/sub/dashboard` | `(sub)` | `src/app/(sub)/layout.tsx` |

**Critical routing rule:** Route groups like `(teacher)` do NOT add a URL segment.
Pages must live in named subdirectories:
- `(teacher)/teacher/page.tsx` → `/teacher` ✓
- `(teacher)/page.tsx` → `/` ✗ (conflicts with root)

---

## Architecture Overview

### Server vs. Client Components
Next.js App Router defaults to Server Components (run on server, can query DB directly).
Interactive pages use the pattern: **Server Component fetches data → passes it to a Client Component**.

Example: `absences/find-sub/[id]/page.tsx` (server, fetches absence) renders
`AbsenceDetailsCard.tsx` (client, handles inline editing) and `FindSubClient.tsx`
(client, handles sub assignment).

### Server Actions
Database writes use Next.js Server Actions — TypeScript `async` functions marked
`'use server'` that the browser can call directly. They run on the server and can
safely access the database and environment variables.

Key action files:
- `src/app/(app)/absences/actions.ts` — all absence CRUD + sub assignment
- `src/app/(app)/admin/actions.ts` — user invite, resend invite, role/status management
- `src/app/(app)/settings/actions.ts` — org settings, sub priority order
- `src/app/(teacher)/actions.ts` — teacher absence submission + history
- `src/app/(sub)/actions.ts` — sub assignments + availability calendar
- `src/app/sub/jobs/[token]/actions.ts` — public accept/decline (no login required)

### Key Architectural Decision: Decoupled Hours Model
`teacher_time_off` (the gap) and `sub_assignments` (the fill) are **separate tables**
linked by the `assignment_time_off` junction table.

This allows one substitute to cover multiple teachers in a single assignment.
**Do NOT merge these tables or combine their data into one record.**

### District / Campus / School Hierarchy

Three levels of organization:

| Level | Table | Purpose |
|-------|-------|---------|
| District | `organizations` + `organizations.district_name` | The paying entity. One org = one district = one Stripe subscription. |
| Campus | `campuses` | Physical address. Schools on the same campus are co-located. |
| School | `schools` + `schools.campus_id` FK | Named division (e.g. Elementary, Middle, High). Teachers and subs are assigned at the school level. |

**Key rules:**
- One org can have multiple campuses (e.g. a district with North and South campuses)
- Each campus can have multiple schools (e.g. ES + MS + HS on one campus)
- Subs are assigned at the school level via `sub_school_assignments`
- Campus-based admin scoping (admins seeing only their campus) is **not yet implemented** — all admins see the full org
- Truly separate campuses that need data isolation should use separate SubHub accounts

**District role:** `users.role = 'district'` — routes to `/district` on login. Read-only dashboard showing all campuses/schools with absence stats. Does not access the admin portal.

**Onboarding flow (as of migration 0022):**
1. Step 1: org basics + district name
2. Step 2: add campus(es) by address (search CA directory or manual) → add schools per campus inline
3. Step 3: billing (seat count + discount options)
4. Step 4: finish

---

## Authentication — Read This Carefully

There are two completely different auth flows. Mixing them up causes hard-to-debug
redirect loops.

### Flow 1: PKCE (used for OAuth / Google sign-in)
1. User clicks "Sign in with Google" → `/auth/callback?code=...`
2. Server Route Handler exchanges the code for a session
3. Redirects to `/auth/portal` → role-based redirect to correct portal

### Flow 2: Implicit (used for ALL invite emails AND recovery/magic links)
Tokens arrive as `#access_token=...` in the URL **hash fragment**.
Servers never see hash fragments — only the browser can read them.
1. User clicks invite or recovery link → lands on `/auth/confirm` (a client-side page)
2. Browser parses the hash, calls `supabase.auth.setSession()` to write session to cookies
3. Redirects to `/auth/portal` → role-based redirect

**Rule:** ALL invite and recovery links must use `/auth/confirm` as the redirect — NOT `/auth/callback`.
Supabase's `inviteUserByEmail` uses implicit flow (hash tokens), even though the docs imply PKCE.
Sending invites to `/auth/callback` causes a silent failure: the server sees no `?code=` param
and redirects to the login page with `error=auth_callback_failed` while the token sits unused in the hash.

**Rule:** The resend invite action deletes the old auth user and re-invites fresh (rather than using
`type: 'recovery'`) because Supabase rejects the invite type for users who already have an auth account.

### Post-login redirect logic (`/auth/portal`)
All flows converge at `/auth/portal` (Route Handler). It reads the session, looks up
the user's role, and redirects:
- `isPlatformAdmin = true` → `/platform` (checked first, before role)
- `admin` / `principal` / `staff` → `/dashboard`
- `teacher` → `/teacher`
- `substitute` → `/sub/dashboard`

For seeded users (imported from Frontline), their `users.id` is a placeholder UUID.
On first login, `/auth/callback` or `/auth/portal` finds them by email and updates
their `users.id` to their real Supabase auth ID.

For new invited users (no `users` row yet), `/auth/portal` reads metadata set during
invite (`firstName`, `lastName`, `role`, `orgId`, `schoolId`, `isPlatformAdmin`) and
creates the row. The `isPlatformAdmin` flag is set when inviting via the IT Staff page.

### Middleware exclusions
`/auth/callback`, `/auth/portal`, and `/auth/confirm` are excluded from the
"authenticated user → redirect to portal" rule in `src/lib/supabase/middleware.ts`.
This lets an admin share a recovery link from their own logged-in browser.

---

## Invite Flow

### Initial invite
1. Admin fills `/admin/users` form → `inviteUser(formData)` server action
2. `supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: '/auth/confirm', data: {firstName, lastName, role, orgId, schoolId} })`
3. Supabase creates the auth user and sends the invite email automatically
4. An `invitations` row is inserted for tracking
5. **No `users` row is created yet** — it's created on first login in `/auth/portal`

### Resend invite
1. Admin clicks Resend → `resendInvite(formData)`
2. Generates a recovery link (not an invite link — see auth notes above)
3. If `RESEND_API_KEY` is set → emails the link via Resend
4. If not set → returns the link so the UI can show a copyable banner

---

## Database Schema (`src/db/schema.ts`)

### Key tables

| Table | Purpose |
|-------|---------|
| `organizations` | Top-level org. Has `autoNotifySubs`, `notifyByEmail`, `notifyBySms`, `notifyByPhone`, `timezone`. Billing fields (migration 0014): `subscriptionStatus` ('trial'/'active'/'past_due'/'expired'), `paidThrough` (date), `paymentMethod` ('stripe'/'check'/'comp'), `stripeCustomerId`, `stripeSubscriptionId`, `onboardingCompletedAt` (null = wizard not done) |
| `billing_events` | Audit log of check payments, Stripe payments, status changes, notes. Written by `/platform/[orgId]` manual form and (future) Stripe webhooks. `createdBy` null = webhook |
| `schools` | Campus within an org. Has `dayStartTime` / `dayEndTime` (HH:MM:SS) |
| `users` | Everyone. `role` enum: admin/principal/staff/teacher/substitute. `isPlatformAdmin` boolean (migration 0014) gates `/platform` access |
| `employees` | Teacher/staff as payroll employee. Links `user → school`. One user can have multiple rows (one per school — e.g. a PE teacher at ES and MS). Never delete a row that has `teacherTimeOff` references. |
| `teacher_time_off` | An absence gap. Has `approvalStatus`, `subOutreachStatus`, `substituteRequired`, `completedAt` (timestamp — set by cron when absence's last day ends) |
| `sub_assignments` | A sub covering a gap. Separate from time-off (decoupled model) |
| `assignment_time_off` | Junction: links assignments ↔ time-off records (many-to-many) |
| `substitutes` | Sub profile. Has `excludedFromSchools` (JSON array of schoolIds) |
| `sub_school_assignments` | Which subs are in which school's pool (`status: active/inactive`) |
| `sub_priority_orders` | Admin-ranked order for notification blast per school |
| `sub_notification_tokens` | UUID tokens for accept/decline deep links (48h expiry). One token per sub per absence. |
| `invitations` | Tracks invite emails: email, role, orgId, expiresAt, usedAt |
| `sub_unavailability` | Dates a sub has marked unavailable. Blast skips these subs |
| `absence_reasons` | Dropdown options per org (Sick Day, Personal Day, etc.) |
| `attachments` | Files attached to absences (lesson plans, etc.). Stored in Supabase Storage |
| `school_directory` | CA public school data from CDE (3,194 schools). Used for school search/claim. |

### Drizzle ORM
- Schema defined in `src/db/schema.ts`
- Database client in `src/db/index.ts`
- Migrations in `drizzle/` — generated by `npx drizzle-kit generate`
- To apply migrations: `npx drizzle-kit push` (or run the SQL in Supabase dashboard)
- **Relations are ORM-only** — adding/changing relations in schema.ts does NOT require a migration

---

## File Storage (Supabase Storage)

Buckets: `absence-attachments` (public), `avatars` (public), `resumes` (public)

All uploads go through server-side API routes (`/api/upload/avatar`, `/api/upload/resume`)
using the admin Supabase client, which bypasses RLS. Direct browser upload would fail
because the RLS policy uses an incompatible path format.

Upload path format: `{orgId}/{userId}-{timestamp}-{filename}`

---

## Supabase Clients — Use the Right One

There are three different Supabase client files. Using the wrong one causes subtle bugs.

| File | Use for | Why |
|------|---------|-----|
| `src/lib/supabase/client.ts` | Client components (`'use client'`) | Uses anon key, runs in browser |
| `src/lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers | Reads cookies for session |
| `src/lib/supabase/admin.ts` | Admin-only operations (invite users, generate links, file upload) | Uses service role key, bypasses RLS |

---

## Environment Variables

| Variable | Local `.env.local` | Vercel | Purpose |
|----------|--------------------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | ✓ | Supabase public/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ | Admin API (bypasses RLS) |
| `DATABASE_URL` | ✓ | ✓ | Postgres connection string (pooled) |
| `NEXT_PUBLIC_APP_URL` | — | ✓ | `https://app.substitutes.us` |
| `RESEND_API_KEY` | — | ✓ | Email sending via Resend (set in Vercel) |
| `TWILIO_ACCOUNT_SID` | ✓ | ✓ | Twilio account |
| `TWILIO_AUTH_TOKEN` | ✓ | ✓ | Twilio auth |
| `TWILIO_PHONE_NUMBER` | ✓ | ✓ | Twilio outbound phone number |
| `CRON_SECRET` | — | ✓ | Bearer token to authenticate cron job calls |

### Supabase Dashboard Settings (must not change)
- Auth → URL Configuration → **Site URL**: `https://app.substitutes.us`
- Auth → URL Configuration → **Redirect URLs**: `https://app.substitutes.us/**`

---

## Notification System

### Overview
The system is **sub-centric**: when a blast goes out, each eligible substitute receives
exactly ONE notification (email + SMS + phone call) listing ALL positions available to
them on that date. This prevents a sub who works at two schools from getting two
simultaneous calls.

### Key files
- `src/lib/notifications.ts` — core blast logic (`notifyAllSubs`)
- `src/lib/sub-job-logic.ts` — shared accept/decline logic used by both web and phone paths
- `src/app/api/twilio/voice/[token]/route.ts` — Twilio calls this when a sub answers
- `src/app/api/twilio/gather/[token]/route.ts` — Twilio calls this when sub presses a digit
- `src/app/sub/jobs/[token]/page.tsx` — public web page (no login) for email accept/decline
- `src/app/sub/jobs/[token]/actions.ts` — server actions for web accept/decline

### Sub pool — who gets notified (post 2026-06-23)

**Default (priorityCallingEnabled = false on the school):**
All subs with an active `sub_school_assignments` row for that school are in the blast.
No configuration required — hiring a sub into a school automatically puts them in the pool.

**Opt-in priority calling (priorityCallingEnabled = true):**
Admin enables per-school via Substitutes → Manage & Review → Call Priority Order tab.
When on, `sub_priority_orders` is used for the pool AND sets the ranking order for the IVR
phone menu ("Press 1 for..."). If the priority list is empty despite the toggle being on,
falls back to the open pool (all assigned subs) — never returns 0.

**Auto-cleanup:** Removing a sub from a school deletes their `sub_priority_orders` rows for
that school. Deactivating a sub clears all their priority order rows org-wide.

### How `notifyAllSubs(ids[])` works
Called with an array of `teacherTimeOff` IDs (all for the same date):
1. Loads each absence with school + teacher info
2. For each school, checks `priorityCallingEnabled` to determine the pool source
3. Builds per-absence sub pools (priority order or open pool per school)
4. Inverts the map: for each unique sub, what positions are they eligible for?
5. Sorts subs by best priority rank (open-pool subs get rank = Infinity, sorted last)
6. Filters out: subs marked unavailable that day, subs already booked, skipped subs
7. For each eligible sub → generates one UUID token per position (reuses existing active token if one exists — prevents duplicates when notify is clicked multiple times)
8. Sends ONE bundled email listing all their positions with individual Accept/Decline links
9. Sends ONE SMS (single position: direct links; multiple: numbered list + dashboard link)
10. Makes ONE voice call (IVR route handles multi-position selection by phone)
11. Marks all absences as `subOutreachStatus = 'sent'`

### Token system
Each `sub_notification_token` row represents one sub's claim on one absence. Fields:
- `token` — UUID used as the URL parameter
- `substituteId` — which sub this is for
- `teacherTimeOffId` — which absence this covers
- `expiresAt` — 48 hours after creation
- `usedAt` — set when accepted or declined
- `action` — `'accepted'` or `'declined'`

**Deduplication:** `generateNotificationToken` checks for an existing active (unexpired,
unused) token for the same (substituteId, teacherTimeOffId) pair before inserting. Clicking
"Notify Subs Immediately" multiple times will NOT create duplicate tokens — the existing
token is reused and the sub gets re-notified with the same accept/decline links.

**Race condition protection:** The accept update uses `WHERE usedAt IS NULL` atomically,
so two simultaneous accepts (e.g. phone + web button at the same time) cannot both succeed.
The second one gets redirected to the "already filled" page.

**Auto-decline:** When a sub accepts any position, ALL their other same-date unused tokens
are immediately marked as declined. This prevents a sub from being double-booked.

**Past-date guard:** The sub dashboard filters out tokens for dates before today. The
server action redirects (not throws) for past-date positions, already-used tokens, and
expired tokens — all land on the "Position No Longer Available" page gracefully.

**Admin cache invalidation:** When a sub accepts via web link or IVR, `revalidatePath` is
called for `/absences/find-sub` and `/dashboard` so the admin sees the filled status
immediately without a manual refresh.

### Blast scheduling — Dispatcher + QStash architecture

**Do not add per-timezone cron entries.** The old approach (10 cron entries with DST doubling)
has been replaced. The new system scales to 1000+ schools across any number of timezones
with zero configuration changes.

#### How it works

```
vercel.json: 3 cron entries (was 11)
  */5 * * * *  →  /api/dispatcher        ← runs every 5 min, timezone-agnostic
  0 2 * * *    →  /api/cron/cleanup-invites
  0 10 * * *   →  /api/cron/billing-alerts

/api/dispatcher (lightweight orchestrator):
  1. Fetches all orgs where cronEnabled = true
  2. For each org: computes current local time using org.timezone
  3. If local time falls in a blast window: publishes one QStash job for that org
  4. Returns in < 1 second regardless of school count

QStash (upstash.com) delivers to per-org blast endpoints:
  /api/blast/evening        — 9:00 PM local, notifies subs for tomorrow
  /api/blast/morning        — 6:00 AM local, blasts today's unfilled positions
  /api/blast/reblast        — 6:20 AM local, re-notifies non-decliners
  /api/blast/unfilled-alert — 6:30 AM local, emails admin if still unfilled
  /api/blast/complete       — 5:30 PM local, stamps completedAt + credits sub
```

Each blast endpoint handles **one org only**. If it returns 5xx, QStash automatically
retries up to 3 times with exponential backoff. One school failing never affects another.

#### Blast windows (5-minute polling)
The dispatcher checks whether the current local time falls within 5 minutes of each
blast target. Since the dispatcher runs every 5 minutes, each window fires exactly once
per day per org. A **deduplication key** (`orgId-blastType-localDate`) is sent with every
QStash message — if the dispatcher fires twice in the same window, QStash silently drops
the duplicate.

| Blast | Local time | What it does |
|-------|-----------|-------------|
| Evening | 9:00 PM | Finds tomorrow's `not_started` positions, calls `notifyAllSubs` |
| Morning | 6:00 AM | Finds today's `not_started` + `sent` positions, calls `notifyAllSubs` |
| Reblast | 6:20 AM | Finds today's still-`sent` positions, calls `reBlastNonDecliners` |
| Unfilled alert | 6:30 AM | Finds today's still-`sent` positions, emails admin |
| Complete | 5:30 PM | Stamps `completedAt`, marks sub assignments `completed` |

**Morning blast processes both `not_started` and `sent` positions** — covers new absences
entered that morning AND positions blasted last night with no takers.

#### Adding a new school
Nothing. The moment a school completes onboarding and their org row exists with
`cronEnabled = true`, the next dispatcher run picks them up automatically. New schools
must set their timezone during onboarding (Step 1 of the wizard) — this is what tells
the dispatcher when 10pm is for them.

#### Security
- `/api/dispatcher` — protected by `Bearer {CRON_SECRET}` header (same as old cron routes)
- `/api/blast/*` — protected by QStash signature verification (`QSTASH_CURRENT_SIGNING_KEY`,
  `QSTASH_NEXT_SIGNING_KEY`). In development, falls back to `Bearer {CRON_SECRET}` so you
  can test blast endpoints directly without real QStash signatures.

#### Environment variables required
| Variable | Purpose |
|----------|---------|
| `QSTASH_URL` | QStash regional base URL (`https://qstash-us-east-1.upstash.io`) |
| `QSTASH_TOKEN` | Auth token for publishing messages to QStash |
| `QSTASH_CURRENT_SIGNING_KEY` | Verifies incoming QStash requests are genuine |
| `QSTASH_NEXT_SIGNING_KEY` | Used during key rotation |

Keys are available in the Upstash QStash console → Overview → .env section.

#### Observability
QStash logs every message delivery, retry, and failure. Go to **upstash.com → QStash → Logs**
to see real-time blast activity. Failed deliveries appear in **DLQ** (Dead Letter Queue) after
all retries are exhausted — these represent schools whose blast failed completely and need
manual investigation.

#### Old cron routes
`src/app/api/cron/evening-blast`, `morning-blast`, `reblast`, `unfilled-alert`,
`complete-absences` are no longer called by Vercel (removed from `vercel.json`) but the
files remain on disk as reference/fallback. They can be deleted once the QStash system
has been running reliably for a few weeks.

### Manual blast
Admin can click "Notify Subs Immediately" on any Find Sub page. This bundles all
same-org same-date `not_started` positions into one blast — not just the one absence
being viewed. The confirm dialog shows how many positions will be bundled.

---

## Voice IVR Flow (Twilio)

When a sub's phone rings and they answer, Twilio calls our webhook:

### `POST /api/twilio/voice/[token]`
The `token` is the primary token used to identify this sub and date.
1. Loads the primary token → gets `substituteId` and `absenceDate`
2. Queries ALL active same-date tokens for this sub (not expired, not used, not filled)
3. Sorts by school name A→Z (consistent with gather route — must match!)
4. Caps at 9 positions (single-digit keypad limit)

**Single position:** "You have a substitute teaching request for [teacher] at [school]
on [date], from [time] to [time]. Press 1 to accept. Press 2 to decline."

**Multiple positions:** "You have [N] positions available on [date].
Press 1 for [school], [teacher]'s class, [time] to [time].
Press 2 for [school2]... Press 0 to hear these options again."

Note: In multi-position mode there is no phone decline option. Subs who want to decline
all positions can use the email links. Unanswered tokens stay open and the sub may be
re-blasted if nobody else fills the position.

### `POST /api/twilio/gather/[token]`
Called when the sub presses a digit. Uses the same sort order as the voice route.

- **Digit 0:** Redirect back to `/api/twilio/voice/[token]` to repeat
- **Single position mode** (positions.length === 1):
  - `1` → accept, `2` → decline
- **Multi-position mode:**
  - `1`–`9` → accept the nth position (index = digit − 1)
  - Any other digit → error message, check email

---

## Sub Job Accept/Decline (Public — No Login)

Two separate paths lead to acceptance. Both use `sub-job-logic.ts` shared logic
for the database writes. The difference: `performAcceptJob` returns a result (for
the IVR path which needs to say "you are confirmed"); `acceptSubJob` redirects
directly (for the web link path).

### Web path (`/sub/jobs/[token]`)
- Public page — no login required. The token in the URL is the authentication.
- `?action=accept` or `?action=decline` in the URL triggers the action automatically
- Confirmation page at `/sub/jobs/[token]/confirmed`

### IVR path (Twilio webhook)
- `performAcceptJob(token)` in `src/lib/sub-job-logic.ts`
- Returns a typed result (`AcceptResult`) instead of redirecting
- The gather route uses the result to speak a confirmation message

---

## Cron Routes

**The primary blast system uses the QStash dispatcher — see "Blast scheduling" above.**
The routes below are legacy files kept for reference. They are no longer called by Vercel.

- `src/app/api/dispatcher/route.ts` — **PRIMARY** — runs every 5 min, publishes per-org QStash jobs
- `src/app/api/blast/evening/route.ts` — per-org evening blast (called by QStash)
- `src/app/api/blast/morning/route.ts` — per-org morning blast (called by QStash)
- `src/app/api/blast/reblast/route.ts` — per-org reblast (called by QStash)
- `src/app/api/blast/unfilled-alert/route.ts` — per-org unfilled alert (called by QStash)
- `src/app/api/blast/complete/route.ts` — per-org complete absences (called by QStash)
- `src/app/api/cron/cleanup-invites/route.ts` — **ACTIVE** nightly, deletes expired invitations
- `src/app/api/cron/billing-alerts/route.ts` — **ACTIVE** daily 10am UTC, sends billing reminder emails
- `src/app/api/cron/evening-blast/route.ts` — LEGACY (no longer called)
- `src/app/api/cron/morning-blast/route.ts` — LEGACY (no longer called)
- `src/app/api/cron/reblast/route.ts` — LEGACY (no longer called)
- `src/app/api/cron/unfilled-alert/route.ts` — LEGACY (no longer called)
- `src/app/api/cron/complete-absences/route.ts` — LEGACY (no longer called)

---

## Stripe Configuration

### Account & Mode
- **Live mode** (not test mode) — real cards, real charges
- Stripe account email: jessegentile@gmail.com
- Stripe SDK version: `stripe@22.2.1` (npm)
- Stripe API version used by webhook destination: `2026-05-27.dahlia`

### Product & Pricing
- **Product**: "SubHub" (`prod_UhQU3p2FS7Gyld`)
- **Price**: $5.00 per unit per month, recurring (`price_1Ti1dlB7AVFO3ftiA0nOLuxN`)
- Billing model: per-teacher. At checkout, `quantity` = number of distinct teachers
  in the org's `employees` table (counted via join to `users`).
- Price ID is hardcoded in `src/app/api/stripe/checkout/route.ts` as `PRICE_ID`.
  To change pricing: create a new price in Stripe dashboard and update that constant.
- Discounts/coupons are managed entirely in the Stripe dashboard — no code needed.
  A 6-month free coupon can be created there and shared with a school.

### Customer Portal
- **Configuration ID**: `bpc_1Ti3sGB7AVFO3ftiL8oWB562`
- **Portal Link**: `billing.stripe.com/p/login/aFaeVcfzYgcv2nYflK8g000`
- Enabled features: invoice history, customer info, payment methods, cancellations, subscriptions
- Our code creates portal sessions via `/api/stripe/portal` (POST) using `stripe.billingPortal.sessions.create()`
- The portal link above can also be shared directly with a customer if needed

### Webhook Destination
- **Destination ID**: recreated 2026-06-13 (original `we_1Ti2iPB7AVFO3ftih0zpsQwJ` was not visible in Workbench after creation — Stripe UI bug)
- **Name**: SubHub Production
- **Endpoint URL**: `https://app.substitutes.us/api/stripe/webhook`
- **Scope**: Your account (not Connected accounts)
- **Payload style**: Snapshot
- **API version**: `2026-05-27.dahlia`
- **Events subscribed** (6 total):
  - `checkout.session.completed` — school completes checkout; saves stripeCustomerId/SubscriptionId, sets status
  - `invoice.paid` — renewal payment succeeds; updates `paidThrough`, sets `active`
  - `invoice.payment_failed` — charge declined; sets `past_due`
  - `customer.subscription.deleted` — subscription cancelled; sets `expired`
  - `customer.subscription.updated` — any subscription change (trial→active, plan change, quantity); syncs status + `paidThrough`
  - `customer.subscription.trial_will_end` — fires 3 days before trial ends; logs billing event (email reminder is future work)

### Key Code Files
| File | Purpose |
|------|---------|
| `src/lib/stripe.ts` | Stripe client singleton (uses `STRIPE_SECRET_KEY`) |
| `src/app/api/stripe/checkout/route.ts` | POST → creates Checkout session, redirects to Stripe |
| `src/app/api/stripe/webhook/route.ts` | POST → handles all 4 webhook events |
| `src/app/(billing)/billing/page.tsx` | Billing page: shows status + Subscribe button |
| `src/app/(billing)/billing/success/page.tsx` | Post-payment success landing page |

### Environment Variables
| Variable | Where | Purpose |
|----------|-------|---------|
| `STRIPE_SECRET_KEY` | Vercel + `.env.local` | Live secret key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Vercel only | Webhook signing secret (`whsec_...`) — local webhook testing requires Stripe CLI, skip for now |

**To add Stripe to local dev:** open `.env.local` and add:
```
STRIPE_SECRET_KEY=sk_live_...
```
`STRIPE_WEBHOOK_SECRET` is not needed locally unless you set up the Stripe CLI to forward webhooks.

### Stripe API v22 Gotchas
The Stripe SDK v22 changed two field locations compared to older docs/tutorials:
- **`subscription.current_period_end`** no longer exists on the Subscription object directly.
  It moved to the subscription item: `sub.items.data[0].current_period_end`.
  Always pass `{ expand: ['items.data'] }` when retrieving a subscription to read this field.
- **`invoice.subscription`** no longer exists as a top-level field on Invoice.
  It moved to: `invoice.parent?.subscription_details?.subscription` (type: `string | Subscription`).
  Extract the ID with: `typeof subRef === 'string' ? subRef : subRef?.id`

### Flow Summary
1. Admin visits `/billing` → sees teacher count and monthly total
2. Clicks "Subscribe with Credit Card" → form POSTs to `/api/stripe/checkout`
3. Server creates Checkout session with `quantity = teacherCount`, redirects to Stripe
4. School enters card info on Stripe-hosted page
5. On success → redirected to `/billing/success`
6. Stripe fires `checkout.session.completed` webhook → org updated to `active` in DB
7. Monthly renewal → `invoice.paid` → `paidThrough` updated
8. Failed payment → `invoice.payment_failed` → org set to `past_due`
9. Cancellation → `customer.subscription.deleted` → org set to `expired`

---

## Security

### Row-Level Security (RLS)
All 19 application tables have RLS enabled (migration `0018_enable_rls.sql`). No
policies are defined — the default "deny all via PostgREST" is intentional.

**Why no policies are needed:** All server-side data access goes through either:
- Drizzle ORM via `DATABASE_URL` (postgres superuser — bypasses RLS)
- Supabase admin client with service role key (bypasses RLS)

The anon key is public, so without RLS any browser could query the REST API directly.
With RLS enabled and no policies, PostgREST access is completely blocked.

**Rule:** Never add a PostgREST data query using the session or anon client. All data
queries must go through Drizzle or the admin client.

---

## Platform Admin System

### The `subhub-platform` org
Platform/IT staff belong to a permanent org with `slug = 'subhub-platform'` rather than
a school org. This means they survive school deletions and are never tied to a customer.

Key properties of this org:
- `subscription_status = 'active'`, `onboarding_completed_at = now()` — skips all gates
- `cron_enabled = false` — no blast emails ever sent from this org
- **Cannot be deleted** — `deleteOrganization` action guards against `slug = 'subhub-platform'`

### `isPlatformAdmin` flag
`users.isPlatformAdmin` (boolean) is the gate for platform access. It is:
- Set `true` when inviting via the IT Staff invite form (passed in Supabase invite metadata)
- Set on first login in `/auth/portal` from `user.user_metadata.isPlatformAdmin`
- Checked in the `(platform)` layout and `getPlatformContext()` action

Platform admins always redirect to `/platform` on login, before role-based routing.

### Impersonation system
Platform admins can view any school's admin portal via an `impersonate_org_id` cookie.

| File | Purpose |
|------|---------|
| `src/lib/impersonation.ts` | `getEffectiveOrgId(userId)` — returns impersonated org if cookie set, otherwise user's own org. `getImpersonatedOrg(isPlatformAdmin)` — returns `{id, name}` or null |
| `src/lib/impersonation-actions.ts` | `setImpersonation(formData)` — validates platform admin, sets cookie, redirects to `/dashboard`. `clearImpersonation()` — clears cookie, redirects to `/platform` |
| `src/components/ImpersonationBanner.tsx` | Yellow banner shown inside the `(app)` shell when impersonating. Shows org name + "Exit to Platform" button |

**How impersonation works in the `(app)` layout:**
1. If `isPlatformAdmin` and no impersonation cookie → redirect to `/platform`
2. If `isPlatformAdmin` and cookie set → use impersonated org's ID for all data queries; skip billing/onboarding redirects; show `ImpersonationBanner`
3. Pages that need `orgId` should call `getEffectiveOrgId(userId)` from `src/lib/impersonation.ts`

**Pages updated to use `getEffectiveOrgId`:** All `(app)` pages and server actions. Every
auth helper (`getOrgAndUserId`, `getAdminContext`, `getOrgId`, etc.) now calls
`getEffectiveOrgId(userId)` instead of reading `profile.organizationId` directly. This means
a platform admin who has set the impersonation cookie will see the target school's data on
every page — absences, users, reports, settings, sub roster, find-sub.

**"View as Admin" button:** on `/platform/[orgId]` page, sets the cookie and enters the
school's `/dashboard`. Sub/teacher portal impersonation is future work.

### Online presence detection
The IT Staff page queries `auth.sessions` (the Supabase auth sessions table) directly
via raw SQL to detect users with unexpired sessions. Wrapped in try/catch — if the table
is inaccessible it silently shows everyone as offline. The platform index strip shows
"IT Staff Online: X" and the IT Staff table shows an ONLINE column (YES/—).

### IT Staff management
Platform admins invite new IT staff from `/platform/[subhub-platform-org-id]`:
- Form: first name, last name, email → `invitePlatformStaff` server action
- Sends Supabase invite email (same `/auth/confirm` flow as school users)
- Metadata includes `isPlatformAdmin: true` → set on user row at first login
- Error handling: if email already registered, shows which org they belong to

---

## Known Pending Work

**Operational (needed for daily use):**
- ~~Completed-absences cron~~ — DONE: fires at 5:30pm local, uses `COALESCE(endDate, startDate) = today`
- ~~Payroll report~~ — DONE: `/reports/sub-pay` printable page + CSV download at `/api/reports/sub-pay`
- ~~Multi-timezone cron support~~ — DONE: 9 vercel.json entries (2 per route for PDT/PST), per-org timezone, `localHour` guard in time-sensitive cron routes
- ~~All pages hardcoding Pacific timezone~~ — DONE: all 12 files updated to use org timezone dynamically
- ~~IVR gather route silent on acceptance~~ — DONE: `twiml()` helper was missing `<Say>` tags; Twilio silently ignored plain text in `<Response>`
- ~~Filled absences staying on admin dashboard all day~~ — DONE: dashboard now hides filled absences once their end time has passed (real-time, no cron dependency)
- ~~Sub dashboard not showing teacher name~~ — DONE: upcoming jobs card shows "Covering for [Teacher Name]"
- ~~Blast notifying 0 subs on new school~~ — DONE 2026-06-23: blast now uses `sub_school_assignments` as default pool; no priority order setup required
- ~~Duplicate tokens from multiple notify clicks~~ — DONE 2026-06-23: `generateNotificationToken` reuses existing active tokens; IVR deduplicates by absenceId
- ~~Find Sub page showing stale data after accept~~ — DONE 2026-06-23: `revalidatePath` added to both web and IVR accept paths
- ~~Server error when clicking already-filled accept link~~ — DONE 2026-06-23: all throws in `acceptSubJob` converted to redirects; lands on "Position No Longer Available" page
- ~~Sub welcome email (silent import)~~ — DONE 2026-06-23: fires in `bulkInviteUsers` when `sendInvites=false` and role=substitute; tells sub to use Forgot Password
- ~~Onboarding confirmation email~~ — DONE 2026-06-23: fires in `completeOnboarding()`; sent to all admins + billing contact; summarizes schools, seats, rate, next steps
- ~~Subscription activated email~~ — DONE 2026-06-23: fires in Stripe webhook `checkout.session.completed`; confirms seats, monthly charge, first billing date
- ~~Logo missing from emails~~ — DONE 2026-06-23: `src/lib/email-utils.ts` `emailHeader()` helper; all emails now use `platform_settings.logoUrl` with text fallback
- ~~Platform discount request card~~ — DONE 2026-06-23: yellow action card on platform org page when `planNotes` starts with `PROMO:`; shows code, billing contact, discounted rate; "Mark as handled" clears it
- ~~Platform nav + Onboarding Guide~~ — DONE 2026-06-23: clean nav row (IT Staff · Email Reference · Onboarding Guide); `/platform/onboarding` documents full signup-to-live flow
- ~~Evening blast time~~ — DONE 2026-06-23: changed from 10pm to 9pm local time
- ~~Promo code silent failure~~ — DONE 2026-06-23: retries with -2/-3 suffix if code already exists in Stripe; errors logged instead of swallowed

**Mid-term (before second school):**
- ~~Admin onboarding wizard~~ — DONE: completely redesigned 2026-06-22. Step 2 = campuses (address via CA directory or manual) + schools per campus inline. Step 3 = seat count + billing contact + 3 discount options (A: send bill+file upload, B: Stripe promo code reveal, C: Stripe 3-month trial). Post-onboarding dashboard checklist Steps 4-6 (fuchsia box).
- ~~Marketing/signup self-registration~~ — DONE: `/auth/signup` with 120-day free trial provisioning; `provisionSelfSignupOrg()` in `src/lib/self-signup.ts`
- ~~Billing enforcement~~ — DONE: `getBillingState()` in `src/lib/billing.ts`; expired orgs → `/billing`; amber `BillingBanner` for trial_ending/past_due
- ~~Platform staff dashboard~~ — DONE: `/platform` (dark theme, isPlatformAdmin gate); org table; `/platform/[orgId]` with check payment form, billing timeline, user management (reset password, clear stuck auth)
- ~~Platform admin identity~~ — DONE: `subhub-platform` org; platform admins no longer tied to school orgs; survive school deletions
- ~~Platform impersonation~~ — DONE: "View as Admin" cookie-based system; `ImpersonationBanner`; `getEffectiveOrgId()` helper
- ~~IT Staff management~~ — DONE: invite form on IT Staff page; online presence via `auth.sessions`
- ~~RLS enabled~~ — DONE: all 19 tables locked down; no PostgREST access without service role
- ~~Reports~~ — DONE: Teacher Absence Summary, Fill Rate Report added; Sub Pay Report improved (sub filter, phone, multi-page print fix)
- Teacher onboarding: simple first-login walkthrough (deferred — schools can invite directly)
- Sub onboarding: profile, availability, schools (partially done via sub portal)

**Longer-term:**
- Platform impersonation for sub/teacher portals: same cookie pattern, needs `(sub)` and `(teacher)` layouts updated to respect `impersonate_org_id`
- ~~More pages using `getEffectiveOrgId()`~~ — DONE: all `(app)` auth helpers updated; platform admins see target school's data on every page when impersonating
- ~~Cron parallel execution~~ — DONE: orgs processed in parallel (`Promise.allSettled`), subs notified in parallel within each org, `maxDuration = 300` on all cron routes; scales to 40+ schools without timeout risk
- ~~Stripe payments~~ — DONE: live mode, $8/seat/month (configurable in platform settings), 90-day trial, coupon support, webhooks, customer portal
- ~~District/campus/school hierarchy~~ — DONE: `campuses` table (migration 0022), `district` role, `/district` portal, `/admin/campuses` page, onboarding Step 2 redesigned (campus address → schools per campus inline). Schools show campus address read-only. `schools.timesConfigured` (migration 0025) requires explicit time entry — no defaults for new schools.
- ~~CSV import error detection~~ — DONE 2026-06-22: school mismatch (orange), duplicates (blue), bad emails (red), invalid roles (rejected before DB), missing columns — all with specific grouped callout boxes
- ~~Notices page~~ — DONE: `/notices` shows bounced emails, subs without school, notifications paused, setup checklist
- ~~Billing page: post-coupon pricing~~ — DONE: fetches Stripe subscription discounts, shows strikethrough + green badge
- ~~Logo~~ — DONE: `https://substitutes.us/subhub-logo.png` on login/signup/confirmation email
- ~~Resend webhook~~ — DONE: `/api/resend/webhook` flags `users.emailBounced`, emails IT staff
- ~~Kill switch email~~ — DONE: fires when `cronEnabled` set to false
- ~~Platform email reference~~ — DONE: `/platform/emails` lists every automated email
- Campus-based admin scoping: deferred — all admins see full org
- District-level reports: `/district` is stub only; deferred until real district customer
- Seat management 48h window: planned — see [[subhub-next-build]]
- Sub rating UI: DB columns exist, no UI yet
- Sub post-assignment report: no DB table or UI yet

**Deferred:**
- Sub job-board: subs browse open positions and apply
- Rich text for notes-to-sub
- ~~Google OAuth consent screen~~ — DONE: custom OAuth credentials from `substitutes-us` Google Cloud project configured in Supabase Auth → Providers → Google
- Microsoft SSO (relevant for school districts on Microsoft 365 — Supabase toggle when needed)
- "Email stalled signup" button on platform org table (fields are there, button not built)

---

## Common Gotchas

**1. Time format in the database**
Times are stored as `HH:MM:SS` (e.g., `07:30:00`). When displaying, slice to `HH:MM`
with `.slice(0, 5)` or parse with `split(':')`.

**2. Date off-by-one**
Always append `T12:00:00` when constructing a `Date` from a `YYYY-MM-DD` string:
`new Date(dateStr + 'T12:00:00')`. Without this, timezone offsets can shift the date
by one day.

**3. Timezone: always use the org's timezone, never hardcode Pacific**
The server runs in UTC. Every page and server action that needs "today's date" must fetch
the org's timezone from `organizations.timezone` and use it explicitly.

```ts
const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
const TZ = org?.timezone ?? 'America/Los_Angeles'
const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ }) // 'YYYY-MM-DD'
```

Use `todayLocal(tz)` from `src/lib/date-utils.ts` as a shorthand. `todayPT()` still
exists for backward compat but should not be used in new code.

**Client components** cannot fetch the org themselves — the parent server component must
fetch the timezone and pass it as a prop. See `past-jobs/page.tsx` → `PastJobsClient.tsx`
as the reference pattern.

**4. `revalidatePath` after mutations**
After any database write, call `revalidatePath()` for all pages that display that data.
Forgetting this causes stale data to show until the next hard refresh.

**5. Drizzle relations vs. migrations**
The `relations()` calls in `schema.ts` are ORM-only metadata — they teach Drizzle how
to do `with:` joins in queries. They do NOT create anything in the database.
Changing relations = no migration needed.
Changing table columns = run `npx drizzle-kit generate` then apply the migration.

**6. Route groups don't add URL segments**
`(app)`, `(teacher)`, `(sub)` are organizational — they affect layouts but not URLs.
A page at `src/app/(teacher)/teacher/page.tsx` maps to `/teacher`, not `/(teacher)/teacher`.

**7. The admin Supabase client bypasses RLS**
`src/lib/supabase/admin.ts` uses the service role key. Only use it for operations that
need to bypass Row Level Security (e.g., inviting users, generating auth links, file upload).
Never use it in client components or expose it to the browser.

**13. Never query data tables via PostgREST**
All 19 tables have RLS enabled with no policies. Any query using `supabase.from('table_name')`
with the session or anon client will return zero rows (silently, no error). All data queries
must use Drizzle (`db.query.*` or `db.select().from(...)`) or the admin client.

**14. Platform admin orgId is the platform org, not a school**
When a platform admin visits `(app)` pages without impersonating, `profile.organizationId`
points to the `subhub-platform` org which has no schools, absences, or users. Pages will
appear empty — this is expected. To see a school's data, use "View as Admin" from `/platform`.
Pages should call `getEffectiveOrgId(userId)` from `src/lib/impersonation.ts` to respect
the active impersonation cookie.

**8. Multi-school teachers**
A teacher who works at multiple campuses has one `employees` row per school (same `userId`,
different `schoolId`). When updating a teacher's school assignments, NEVER delete an
`employees` row that has `teacherTimeOff` records pointing to it — this breaks a foreign
key constraint. Only add new rows or remove rows with no absence history.

**9. IVR sort order must match between voice and gather routes**
Both `/api/twilio/voice/[token]` and `/api/twilio/gather/[token]` sort positions by
school name ascending before assigning digit numbers. If you change the sort in one,
change it in the other — otherwise "Press 2" accepts the wrong position.

**10. Token race condition is handled at the database level**
The token accept update uses `WHERE usedAt IS NULL` so only one concurrent accept wins.
Do NOT add application-level locking or retries — the DB constraint is sufficient.

**11. Multi-day absences: use COALESCE for "last day" queries**
`endDate` is null for single-day absences. Whenever you need "the last day of this absence",
always use `COALESCE(endDate, startDate)` — not just `startDate` or `endDate` alone.

```ts
// Correct: "absences fully in the past"
sql`COALESCE(${teacherTimeOff.endDate}, ${teacherTimeOff.startDate}) < ${today}`

// Correct: "absences whose last day is today" (used by complete-absences cron)
sql`COALESCE(${teacherTimeOff.endDate}, ${teacherTimeOff.startDate}) = ${today}`
```

Using `startDate = today` for completion would mark a Mon–Fri absence complete on Monday.

**12. Drizzle migrations must be applied manually**
`npx drizzle-kit push` requires an interactive TTY — it won't work inside Claude Code.
After generating a migration with `npx drizzle-kit generate`, copy the SQL and run it
directly in the Supabase SQL editor. Applied migrations so far: `0012_org_timezone.sql`,
`0013_completed_at.sql`, `0014_billing_and_signup.sql` (billing columns,
isPlatformAdmin, billing_events table — applied 2026-06-13).
