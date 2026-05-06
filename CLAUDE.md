# SubHub — Claude Code Guide

SubHub is a substitute teacher management SaaS for K-12 schools, built as a direct
competitor to Frontline/Aesop. The initial customer is Southlands Christian Schools.
The owner (Jesse) is a school principal, not a developer — keep code well-commented
and avoid unnecessary abstractions.

---

## Deployment & Repositories

| Thing | Location |
|-------|----------|
| Code | `/Users/jessegentile/.openclaw/workspace/substitute-app/` |
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
| `organizations` | Top-level org (school district). Has `autoNotifySubs`, `notifyByEmail`, `notifyBySms` |
| `schools` | Campus within an org. Has `dayStartTime` / `dayEndTime` (HH:MM:SS) |
| `users` | Everyone. `role` enum: admin/principal/staff/teacher/substitute |
| `employees` | Teacher/staff as payroll employee. Links `user → school` |
| `teacher_time_off` | An absence gap. Has `approvalStatus`, `subOutreachStatus`, `substituteRequired` |
| `sub_assignments` | A sub covering a gap. Separate from time-off (decoupled model) |
| `assignment_time_off` | Junction: links assignments ↔ time-off records (many-to-many) |
| `substitutes` | Sub profile. Has `excludedFromSchools` (JSON array of schoolIds) |
| `sub_priority_orders` | Admin-ranked order for notification blast |
| `sub_notification_tokens` | UUID tokens for accept/decline deep links (48h expiry) |
| `invitations` | Tracks invite emails: email, role, orgId, expiresAt, usedAt |
| `sub_unavailability` | Dates a sub has marked unavailable. Blast skips these subs |
| `absence_reasons` | Dropdown options per org (Sick Day, Personal Day, etc.) |
| `attachments` | Files attached to absences (lesson plans, etc.). Stored in Supabase Storage |

### Drizzle ORM
- Schema defined in `src/db/schema.ts`
- Database client in `src/db/index.ts`
- Migrations in `drizzle/` — generated by `npx drizzle-kit generate`
- To apply migrations: `npx drizzle-kit push` (or run the SQL in Supabase dashboard)
- **Relations are ORM-only** — adding/changing relations in schema.ts does NOT require a migration

---

## File Storage (Supabase Storage)

Bucket: `absence-attachments` (public bucket — files are readable by URL)

Upload policy: authenticated users only (`auth.role() = 'authenticated'`).

Upload path format: `{orgId}/{userId}-{timestamp}-{filename}`

Files upload directly from the browser using the Supabase JS client (anon key).
After upload, a row is saved to the `attachments` table via a server action.

Deleting an attachment removes the database row. The file remains in storage
(orphaned) — storage cleanup can be done manually or added as a cron job later.

---

## Supabase Clients — Use the Right One

There are three different Supabase client files. Using the wrong one causes subtle bugs.

| File | Use for | Why |
|------|---------|-----|
| `src/lib/supabase/client.ts` | Client components (`'use client'`) | Uses anon key, runs in browser |
| `src/lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers | Reads cookies for session |
| `src/lib/supabase/admin.ts` | Admin-only operations (invite users, generate links) | Uses service role key, bypasses RLS |

---

## Environment Variables

| Variable | Local `.env.local` | Vercel | Purpose |
|----------|--------------------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | ✓ | Supabase public/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ | Admin API (bypasses RLS) |
| `DATABASE_URL` | ✓ | ✓ | Postgres connection string (pooled) |
| `NEXT_PUBLIC_APP_URL` | — | ✓ | `https://app.substitutes.us` |
| `RESEND_API_KEY` | — | — | Email sending. **Not set** — resend shows a copyable link instead |
| `TWILIO_*` | ✓ | ✓ | SMS and voice IVR for sub notifications |

### Supabase Dashboard Settings (must not change)
- Auth → URL Configuration → **Site URL**: `https://app.substitutes.us`
- Auth → URL Configuration → **Redirect URLs**: `https://app.substitutes.us/**`

---

## Notification System (`src/lib/notifications.ts`)

When "Notify All Subs" is triggered for an absence:
1. Loads subs in priority order (from `sub_priority_orders`)
2. Filters out subs who marked the absence date as unavailable (`sub_unavailability`)
3. Filters out subs excluded from the school (`substitutes.excludedFromSchools`)
4. For each eligible sub, generates a UUID token (`sub_notification_tokens`, 48h expiry)
5. Builds an email with Accept / Decline deep links (no login required)
6. Sends via Resend (or logs to console if `RESEND_API_KEY` is not set)
7. If Twilio is configured, also sends SMS and/or initiates a voice IVR call

The deep links go to `/sub/jobs/[token]` — a public page that reads the token, shows
the job details, and lets the sub accept or decline without creating an account.

---

## Sub Job Accept/Decline (Public — No Login)

`src/app/sub/jobs/[token]/page.tsx` and `actions.ts`

- The token is looked up in `sub_notification_tokens`
- Tokens expire after 48 hours (`expiresAt`)
- On Accept: creates a `sub_assignments` row, links it via `assignment_time_off`,
  marks the absence as `filled`, marks the token as used
- On Decline: marks the token as used with `action = 'declined'`
- The confirmation page is at `/sub/jobs/[token]/confirmed`

---

## Seed Data

41 real teachers imported from Frontline (emails: `lavila@southlandscs.com` format).
18 substitutes seeded. These have placeholder UUIDs as `users.id` — the real Supabase
auth ID is linked on first login.

Seed scripts: `src/db/seed.ts`, `src/db/seed-teachers.ts`, `src/db/seed-subs.ts`

---

## Known Pending Work

- **`RESEND_API_KEY` not set in Vercel** — email sending shows a copyable link instead of sending automatically. Add the key to Vercel env vars to enable.
- **Staff role nav restrictions** — staff users currently see all admin navigation including Settings and Manage Users. These should be hidden for the `staff` role.
- **Sub job-board** — substitutes browsing open positions and applying (Phase 5, deferred).
- **Reconciliation payroll details** — sub rating and exact hour adjustments on the Reconcile page (deferred).

---

## Common Gotchas

**1. Time format in the database**
Times are stored as `HH:MM:SS` (e.g., `07:30:00`). When displaying, slice to `HH:MM`
with `.slice(0, 5)` or parse with `split(':')`.

**2. Date off-by-one**
Always append `T12:00:00` when constructing a `Date` from a `YYYY-MM-DD` string:
`new Date(dateStr + 'T12:00:00')`. Without this, timezone offsets can shift the date
by one day.

**3. `revalidatePath` after mutations**
After any database write, call `revalidatePath()` for all pages that display that data.
Forgetting this causes stale data to show until the next hard refresh.

**4. Drizzle relations vs. migrations**
The `relations()` calls in `schema.ts` are ORM-only metadata — they teach Drizzle how
to do `with:` joins in queries. They do NOT create anything in the database.
Changing relations = no migration needed.
Changing table columns = run `npx drizzle-kit generate` then apply the migration.

**5. Route groups don't add URL segments**
`(app)`, `(teacher)`, `(sub)` are organizational — they affect layouts but not URLs.
A page at `src/app/(teacher)/teacher/page.tsx` maps to `/teacher`, not `/(teacher)/teacher`.

**6. The admin Supabase client bypasses RLS**
`src/lib/supabase/admin.ts` uses the service role key. Only use it for operations that
need to bypass Row Level Security (e.g., inviting users, generating auth links).
Never use it in client components or expose it to the browser.
