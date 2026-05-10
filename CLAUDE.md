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

---

## Authentication — Read This Carefully

There are two completely different auth flows. Mixing them up causes hard-to-debug
redirect loops.

### Flow 1: PKCE (used for initial invite emails and OAuth)
1. User clicks invite email link → lands on `/auth/callback?code=...`
2. Server Route Handler exchanges the code for a session
3. Redirects to `/auth/portal` → role-based redirect to correct portal

### Flow 2: Implicit (used for password reset / "resend invite" recovery links)
Tokens arrive as `#access_token=...` in the URL **hash fragment**.
Servers never see hash fragments — only the browser can read them.
1. User clicks link → lands on `/auth/confirm` (a client-side page)
2. Browser calls `supabase.auth.getSession()` — the SDK reads the hash and writes the session to cookies
3. Redirects to `/auth/portal` → role-based redirect

**Rule:** Recovery links must use `/auth/confirm` as the redirect, not `/auth/callback`.
**Rule:** The resend invite action must use `type: 'recovery'`, not `type: 'invite'`,
because Supabase rejects the invite type for users who already have an auth account.

### Post-login redirect logic (`/auth/portal`)
All flows converge at `/auth/portal` (Route Handler). It reads the session, looks up
the user's role, and redirects:
- `admin` / `principal` / `staff` → `/dashboard`
- `teacher` → `/teacher`
- `substitute` → `/sub/dashboard`

For seeded users (imported from Frontline), their `users.id` is a placeholder UUID.
On first login, `/auth/callback` or `/auth/portal` finds them by email and updates
their `users.id` to their real Supabase auth ID.

For new invited users (no `users` row yet), `/auth/portal` reads metadata set during
invite (`firstName`, `lastName`, `role`, `orgId`, `schoolId`) and creates the row.

### Middleware exclusions
`/auth/callback`, `/auth/portal`, and `/auth/confirm` are excluded from the
"authenticated user → redirect to portal" rule in `src/lib/supabase/middleware.ts`.
This lets an admin share a recovery link from their own logged-in browser.

---

## Invite Flow

### Initial invite
1. Admin fills `/admin/users` form → `inviteUser(formData)` server action
2. `supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: '/auth/callback', data: {firstName, lastName, role, orgId, schoolId} })`
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
| `organizations` | Top-level org (school district). Has `autoNotifySubs`, `notifyByEmail`, `notifyBySms`, `notifyByPhone` |
| `schools` | Campus within an org. Has `dayStartTime` / `dayEndTime` (HH:MM:SS) |
| `users` | Everyone. `role` enum: admin/principal/staff/teacher/substitute |
| `employees` | Teacher/staff as payroll employee. Links `user → school`. One user can have multiple rows (one per school — e.g. a PE teacher at ES and MS). Never delete a row that has `teacherTimeOff` references. |
| `teacher_time_off` | An absence gap. Has `approvalStatus`, `subOutreachStatus`, `substituteRequired` |
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

### How `notifyAllSubs(ids[])` works
Called with an array of `teacherTimeOff` IDs (all for the same date):
1. Loads each absence with school + teacher info
2. For each school, fetches that school's active sub pool (`sub_school_assignments`)
3. Inverts the map: for each unique sub, what positions are they eligible for?
4. Sorts subs by their best priority rank across all schools
5. Filters out: subs marked unavailable that day, subs already booked, skipped subs
6. For each eligible sub → generates one UUID token per position (stored in `sub_notification_tokens`, 48h expiry)
7. Sends ONE bundled email listing all their positions with individual Accept/Decline links
8. Sends ONE SMS (single position: direct links; multiple: numbered list + dashboard link)
9. Makes ONE voice call (IVR route handles multi-position selection by phone)
10. Marks all absences as `subOutreachStatus = 'sent'`

### Token system
Each `sub_notification_token` row represents one sub's claim on one absence. Fields:
- `token` — UUID used as the URL parameter
- `substituteId` — which sub this is for
- `teacherTimeOffId` — which absence this covers
- `expiresAt` — 48 hours after creation
- `usedAt` — set when accepted or declined
- `action` — `'accepted'` or `'declined'`

**Race condition protection:** The accept update uses `WHERE usedAt IS NULL` atomically,
so two simultaneous accepts (e.g. phone + web button at the same time) cannot both succeed.
The second one gets redirected to the "already filled" page.

**Auto-decline:** When a sub accepts any position, ALL their other same-date unused tokens
are immediately marked as declined. This prevents a sub from being double-booked.

**Past-date guard:** The sub dashboard filters out tokens for dates before today. The
server action also rejects acceptance of past-date positions as a second line of defense.

### Cron schedule (`vercel.json`)
All times are UTC. Southlands is in Pacific time:
- PDT (summer, Mar–Nov): UTC−7 → evening blast = 11pm, morning blast = 7am
- PST (winter, Nov–Mar): UTC−8 → evening blast = 10pm, morning blast = 6am

| Cron | UTC schedule | Pacific (PDT) | What it does |
|------|-------------|----------------|-------------|
| Evening blast | `0 6 * * *` | ~11pm | Notifies subs for tomorrow's `not_started` positions |
| Morning blast | `0 14 * * *` | ~7am | Catches same-day positions submitted overnight |
| Unfilled alert | `30 14 * * *` | ~7:30am | Emails admin if any position is still unfilled |

Crons only process positions with `subOutreachStatus = 'not_started'`. Once a blast runs,
status becomes `'sent'` and the crons won't touch it again. Re-blasts go through
`reBlastNonDecliners()` in `notifications.ts`.

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

All cron routes check a `Bearer {CRON_SECRET}` authorization header to prevent
unauthorized calls. Vercel sends this automatically from the cron config in `vercel.json`.

- `src/app/api/cron/evening-blast/route.ts` — finds tomorrow's `not_started` positions, groups by org, calls `notifyAllSubs` once per org
- `src/app/api/cron/morning-blast/route.ts` — same pattern but for today's positions
- `src/app/api/cron/unfilled-alert/route.ts` — emails admin if any position is still unfilled by morning

---

## Known Pending Work

**Operational (needed for daily use):**
- Completed-absences cron: 4pm Pacific daily, marks absences whose endTime has passed, moves them off dashboard, gives sub credit
- Payroll report: exportable CSV of sub hours per pay period — the main output for whoever writes paychecks

**Mid-term (before second school):**
- Admin onboarding wizard: multi-step school setup (org, schools, pay model, users, subs)
- Teacher onboarding: simple first-login walkthrough
- Sub onboarding: profile, availability, schools

**Longer-term:**
- Marketing/signup site: school discovers SubHub and self-registers
- Payment system: Stripe subscriptions, tier by school size, admin discount override

**Deferred:**
- Sub job-board: subs browse open positions and apply
- Rich text for notes-to-sub
- Google OAuth consent screen: shows raw Supabase project ID — fix in Google Cloud Console

---

## Common Gotchas

**1. Time format in the database**
Times are stored as `HH:MM:SS` (e.g., `07:30:00`). When displaying, slice to `HH:MM`
with `.slice(0, 5)` or parse with `split(':')`.

**2. Date off-by-one**
Always append `T12:00:00` when constructing a `Date` from a `YYYY-MM-DD` string:
`new Date(dateStr + 'T12:00:00')`. Without this, timezone offsets can shift the date
by one day.

**3. Timezone: always use Pacific explicitly**
The server runs in UTC. Never use `new Date().toISOString()` to get today's date for
display or query purposes — it will be wrong for Pacific users after 4pm.
Always use:
```ts
const TZ = 'America/Los_Angeles'
const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: TZ }) // 'YYYY-MM-DD'
```

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
