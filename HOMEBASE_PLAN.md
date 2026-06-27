# Homebase: Shared Core Platform Plan

_Strategic architecture plan for evolving SubHub into a multi-product SaaS platform
targeting K-12 private schools. Written 2026-06-24._

---

## 1. CURRENT STATE ANALYSIS

### What SubHub already has that could serve as the core

SubHub is further along than it might appear. The following infrastructure is either
already product-agnostic or easily made so:

**Organization & hierarchy layer**
- `organizations` — the paying legal entity. Already handles billing, Stripe IDs,
  subscription status, trial logic, timezone, onboarding state, and district metadata.
  This is the backbone of any multi-product school platform.
- `campuses` — physical address. Clean, no SubHub-specific fields.
- `schools` — named divisions (Elementary, Middle, High) on a campus. Carries address,
  phone, timezone, and basic hours. Mostly clean; two fields are SubHub-specific
  (see gaps below).
- `school_directory` — CA public school seed data with lat/lng. Useful for any product
  that needs to discover or link to real schools.

**Identity layer**
- `users` — all humans. Has role, org, school, status, `isPlatformAdmin`, bounce tracking.
  Well-structured. The `role` enum is the main issue (detailed below).
- `invitations` — invite tracking with expiry. Product-agnostic.
- Supabase Auth — handles PKCE/OAuth/implicit flows. Already working. Invite and
  recovery flows are documented and battle-tested in SubHub.

**Billing layer**
- `billing_events` — audit log for all payment activity. Product-agnostic already.
- `platform_settings` — singleton with price-per-seat, Stripe price ID, logo, app name.
  Needs to evolve for multi-product but the pattern is sound.
- Stripe integration — checkout session, webhooks for 6 event types, customer portal.
  All in `src/app/api/stripe/` and `src/lib/stripe.ts`.

**Platform admin layer**
- `(platform)` route group — dark-theme IT staff dashboard, per-org management,
  billing timeline, impersonation system.
- `src/lib/impersonation.ts` — `getEffectiveOrgId()` pattern already provides the
  mechanism for platform admins to view any school's data.
- `src/lib/billing.ts` — `getBillingState()` is pure, stateless, easily reused.

**Notification infrastructure**
- QStash dispatcher + per-org blast endpoints. The architecture (dispatcher publishes
  per-org jobs, each org's blast runs independently) scales horizontally and is product-agnostic
  in pattern. Other products could publish their own job types to the same QStash account.

### What is product-specific vs. what is truly shared

**SubHub-only fields in shared tables** (the coupling that needs cleaning up):

| Table | SubHub-specific fields |
|-------|----------------------|
| `organizations` | `auto_notify_subs`, `notify_by_sms`, `notify_by_email`, `notify_by_phone`, `sub_pay_model`, `half_day_hours`, `full_day_hours`, `cron_enabled`, `seat_count`, `pending_seat_count`, `pending_seat_update_at` |
| `schools` | `priority_calling_enabled`, `times_configured`, `day_start_time`, `day_end_time` |
| `platform_settings` | `app_name`, `price_per_seat_cents`, `stripe_price_id` (implies one product) |

Note: `day_start_time` / `day_end_time` may actually be useful for Campus Lock
(geofence windows often align with school hours), so they could legitimately stay in `schools`.
The others are clearly SubHub-only.

**Purely SubHub tables** (no changes needed, they stay in the SubHub product schema):

- `employees` — teacher/staff rosters
- `substitutes` — sub profiles
- `teacher_time_off` — absence records
- `sub_assignments` — coverage records
- `assignment_time_off` — junction
- `sub_school_assignments` — which subs work at which school
- `sub_priority_orders` — IVR call order
- `sub_notification_tokens` — accept/decline deep links
- `sub_unavailability` — sub calendar
- `absence_reasons` — per-org dropdown
- `user_school_notification_prefs` — absence alert prefs
- `attachments` — lesson plans (though the pattern could be shared)

**Role enum problem**
The `roleEnum` contains `['admin', 'principal', 'staff', 'teacher', 'substitute', 'district']`.
`teacher` and `substitute` are SubHub-specific roles. Campus Lock doesn't have substitutes;
it has students and parents. Adding `student` and `parent` to this enum pollutes the shared
identity layer with product-specific concepts. This needs architectural resolution.

### Current schema strengths

1. The org → campus → school hierarchy is exactly right. Most competing platforms
   flatten this (org = school), which causes pain when a district adds a second campus.
   SubHub's three-level design is ready for multi-campus districts from day one.

2. The decoupled `teacher_time_off` / `sub_assignments` junction model is a good example
   of what product-specific design should look like — completely self-contained.

3. RLS is locked down (all tables, no policies). The application layer exclusively controls
   access via Drizzle + service role. This is the right call for a multi-product system —
   it avoids complex cross-product RLS policy interactions.

4. `isPlatformAdmin` on `users` rather than a separate table keeps the privilege check fast
   and simple. Good pattern to keep.

5. The `subhub-platform` org (special slug) pattern is a clean way to give IT staff their
   own identity without tying them to any school.

### Current schema gaps for multi-product

1. No `products` catalog table
2. No `org_products` activation table (which products does this org have active?)
3. No `students` table (Campus Lock's primary entity)
4. `platform_settings` assumes one product (single `price_per_seat_cents`)
5. Billing is per-teacher only; Campus Lock would need per-student billing

---

## 2. PROPOSED CORE SCHEMA

### Core tables (shared across all products)

These tables belong to what we're calling "Homebase" — the shared layer:

**Unchanged (already clean):**
- `organizations` — after removing SubHub-specific fields (see migration below)
- `campuses` — no changes needed
- `schools` — after removing `priority_calling_enabled` and `times_configured`
  (optionally keep `day_start_time`/`day_end_time` as they apply to any school context)
- `invitations` — no changes needed
- `billing_events` — no changes needed
- `school_directory` — no changes needed

**Evolved:**
- `users` — drop `teacher` and `substitute` from the role enum; keep `admin`, `principal`,
  `staff`, `district`. Product-specific roles (teacher, substitute, parent, student) move to
  product-level profile tables.
- `platform_settings` — remove `price_per_seat_cents` and `stripe_price_id`; those move to
  the `products` table. Keep `staff_alert_email`, `logo_url`.

**New core tables:**

`products` — catalog of available SaaS products
- `id` — UUID
- `slug` — text, unique (`subhub`, `campus_lock`, `classroom_monitor`)
- `name` — text (`SubHub`, `Campus Lock`)
- `description` — text
- `stripe_price_id` — the Stripe price object for this product
- `price_per_unit_cents` — integer (e.g. 800 = $8/seat/mo)
- `billing_unit` — text (`teacher`, `student`, `seat`) — what quantity means for this product
- `active` — boolean (is this product available for purchase)
- `createdAt`, `updatedAt`

`org_products` — which orgs have activated which products
- `id` — UUID
- `organization_id` → `organizations.id`
- `product_id` → `products.id`
- `status` — text (`trial`, `active`, `past_due`, `expired`, `cancelled`)
- `stripe_subscription_item_id` — text (the line item ID on the shared subscription)
- `unit_count` — integer (e.g. teacher count for SubHub, student count for Campus Lock)
- `pending_unit_count` — integer (same 48h window pattern as SubHub's seat management)
- `pending_unit_update_at` — timestamp
- `activated_at` — timestamp
- `deactivated_at` — timestamp
- `paid_through` — date
- `createdAt`, `updatedAt`
- Unique constraint on `(organization_id, product_id)`

`students` — student profiles (needed by Campus Lock)
- `id` — UUID
- `organization_id` → `organizations.id`
- `first_name`, `last_name` — text
- `grade` — text
- `status` — active/inactive
- `parent_ids` — jsonb array of user IDs (parents linked as users with a `parent` role)
- `createdAt`, `updatedAt`

`student_school_enrollments` — which students attend which school
- `id` — UUID
- `student_id` → `students.id`
- `school_id` → `schools.id`
- `organization_id` → `organizations.id`
- `status` — active/inactive
- `enrolledAt`, `unenrolledAt`

### Role handling across products

The `users.role` field should represent only org-level administrative roles:
- `admin` — school/org admin
- `principal` — principal (view/approve access)
- `staff` — office staff
- `district` — district-level read-only view
- (Remove `teacher` and `substitute`)

Product-specific role/participation is expressed via profile tables, not the role enum:

| Product | Profile table | What it tracks |
|---------|--------------|----------------|
| SubHub | `employees` | This user is a teacher/staff member |
| SubHub | `substitutes` | This user is a substitute |
| Campus Lock | `student_guardians` | This user is a parent/guardian |
| All | `users.role` | Administrative role within the org |

This means a person who is both a SubHub substitute AND a Campus Lock parent guardian
has ONE `users` row, ONE Supabase auth identity, and rows in both `substitutes` and
`student_guardians`. Login works once; the portal routes to all relevant products.

**Practical migration note:** When you remove `teacher` and `substitute` from the role
enum, existing SubHub teacher/substitute users need their role changed to `staff` (or a
new neutral value like `member`). Their identity as teachers/subs lives in `employees` and
`substitutes` — the portal routing for SubHub would check for an `employees` or `substitutes`
row rather than `users.role`. This is a small but breaking change to SubHub's routing in
`/auth/portal`.

### SubHub-specific tables that move to a product schema

Move these SubHub settings out of `organizations` into a `subhub_org_settings` table:
- `auto_notify_subs`
- `notify_by_sms`, `notify_by_email`, `notify_by_phone`
- `sub_pay_model`, `half_day_hours`, `full_day_hours`
- `cron_enabled`

Move these SubHub settings out of `schools` into a `subhub_school_settings` table:
- `priority_calling_enabled`
- `times_configured`

All SubHub product tables (employees, substitutes, teacher_time_off, etc.) remain exactly
as they are. They reference the core tables (`organizations`, `schools`, `users`) via foreign
keys, but they live conceptually in the SubHub product layer.

Similarly, Campus Lock tables (geofences, check_ins, devices) reference the same core
tables. The database has no schema namespacing in Postgres (without extensions), but by
convention, Campus Lock tables would be prefixed `cl_` and SubHub tables prefixed `sh_`
or kept with their current names.

### What the full table map looks like

```
CORE (Homebase)                    SUBHUB product          CAMPUS LOCK product
──────────────────                 ─────────────────        ──────────────────────
organizations                      employees                cl_devices
campuses                           substitutes              cl_geofences
schools                            teacher_time_off         cl_check_ins
users                              sub_assignments          cl_student_phones
students                           assignment_time_off      cl_attendance_records
student_school_enrollments         sub_school_assignments   cl_incidents
products                           sub_priority_orders      cl_parent_alerts
org_products                       sub_notification_tokens  
invitations                        sub_unavailability
billing_events                     absence_reasons
school_directory                   attachments
platform_settings                  subhub_org_settings
                                   subhub_school_settings
                                   user_school_notif_prefs
```

All tables — core and product — live in the same Postgres database (same Supabase project).
Separation is logical, not physical, enforced by code conventions and naming.

---

## 3. AUTHENTICATION STRATEGY

### Standardize on Supabase Auth

SubHub uses Supabase Auth and it's working well. Campus Lock reportedly uses custom JWT.
**Standardize on Supabase Auth for all products.** Reasons:

1. **It's already battle-tested in SubHub.** The PKCE/implicit dual-flow gotchas are
   documented in CLAUDE.md and worked around. Rebuilding this in a custom JWT system
   means re-learning the same lessons.

2. **Admin SDK is powerful.** `supabase.auth.admin.inviteUserByEmail()` handles the invite
   flow with zero custom code. For Campus Lock's student/parent onboarding, the same invite
   system works.

3. **One auth.users table for all products.** A teacher who is also a parent (common in
   private schools) has ONE login for both SubHub and Campus Lock. Cross-product SSO is
   automatic when auth is shared.

4. **Google OAuth is already configured.** The `substitutes-us` Google Cloud project has
   custom OAuth credentials in Supabase. All products benefit from this.

5. **Migrating Campus Lock off custom JWT.** For new Campus Lock functionality: write it
   against Supabase Auth from the start. For existing Campus Lock data: migration script
   that creates Supabase auth users from the custom JWT user store.

### Cross-product login flow

Today SubHub's `/auth/portal` reads `users.role` and redirects to the appropriate portal.
With multiple products, the logic expands:

```
/auth/portal (post-login gateway)
  1. isPlatformAdmin → /platform  (no change)
  2. Load user's org_products to see which products are active for their org
  3. Load user's profile records (employees row? substitutes row? student_guardian row?)
  4. If user has access to exactly one product → route directly
  5. If user has access to multiple products → /portal (product selector page)
  6. SubHub teacher/sub → /teacher or /sub/dashboard  (no change, just via profile check)
  7. Campus Lock parent/student → /campus-lock/...
```

For the near term (SubHub only), none of this changes. The expansion happens when
Campus Lock launches.

### Role hierarchy across products

```
Platform layer:    isPlatformAdmin (boolean on users) — IT staff, god mode
Org layer:         users.role (admin/principal/staff/district) — org administration
Product layer:     employees, substitutes, student_guardians rows — product participation
```

A user can simultaneously be an `admin` at the org level (can manage SubHub settings)
AND a student's parent (Campus Lock guardian). These roles don't conflict because they
operate at different layers.

**One key decision to make:** Should parents be `users` rows (with a Supabase auth account
and login capability) or lightweight profile records? Campus Lock likely needs parents to
receive push notifications (no login required), so there are two models:
- **Model A:** Parents are users with accounts — can log in to see their child's attendance.
  This is the right long-term answer.
- **Model B:** Parents are just contact records — no login, just SMS/push recipients.
  Simpler to start.

Recommendation: Start with Model B for Campus Lock's initial build; add login capability
when the parent-facing app is ready. Don't let the auth system design be blocked by this.

---

## 4. BILLING STRATEGY

### Current state

SubHub bills `$8/teacher/month` via a single Stripe subscription per org. The `seatCount`
in `organizations` tracks purchased seats; the daily cron detects divergence and enforces a
48-hour commit window. Stripe quantity = seatCount on commit.

### Target state: one subscription, multiple line items

When an org has multiple products, use **one Stripe subscription with multiple subscription
items** — one item per active product. Schools get one monthly invoice. Stripe supports this
natively.

Example subscription for an org with both SubHub and Campus Lock:
```
Subscription: sub_ABC123
  Item 1: price_subhub (qty = 45 teachers)   → $360/mo
  Item 2: price_campus_lock (qty = 500 students) → $250/mo
  Total invoice: $610/mo
```

Each `org_products` row stores the `stripe_subscription_item_id` for its line item.
Adding a product = adding a subscription item. Removing = deleting the item (or pausing).

**Why not separate subscriptions?**
Separate subscriptions mean separate invoices, separate failed-payment states, and separate
cancellation events. Schools would receive two bills from two Stripe subscriptions for the
same vendor — confusing and harder to support. One subscription is simpler for everyone.

**Why not usage-based/metered billing?**
Private K-12 schools budget annually. Predictable flat rates ("$X/month") beat metered
billing in this market. Keep the current seat-count model.

### Changes needed to SubHub billing

1. **Move `stripe_price_id` and `price_per_seat_cents` out of `platform_settings`.**
   They belong in the `products` table (one price per product). `platform_settings` keeps
   only global settings.

2. **Move `seatCount`, `pendingSeatCount`, `pendingSeatUpdateAt` out of `organizations`.**
   These belong in `org_products` as `unit_count`, `pending_unit_count`, `pending_unit_update_at`.
   SubHub's `org_products` row for an org is the source of truth for seat count.

3. **Stripe checkout creates a subscription with one item (SubHub).** When Campus Lock is
   added later, a second item is added to the existing subscription. The checkout route
   (`src/app/api/stripe/checkout/route.ts`) needs a product parameter.

4. **The seat-management cron** (`/api/cron/seat-auto-commit`) reads from `org_products`
   instead of `organizations`. The 48-hour window logic is unchanged; it just operates on
   the right table.

5. **SubHub billing enforcement** (`src/lib/billing.ts`, `getBillingState()`) stays in place.
   It will call `org_products WHERE product_slug = 'subhub'` instead of reading the billing
   fields directly from `organizations`. The billing state shape doesn't change.

6. **The billing page** (`/billing`) shows SubHub's subscription status. When other products
   are added, this page becomes a "Manage Products" page showing all active products and
   their unit counts.

### When to make these billing changes

These changes only need to happen **before launching the second product**, not before
Campus Lock development begins. During Campus Lock development (which will be on a separate
repo or route group), billing is unchanged. The migration happens when the first school
buys both products.

### Discount and promo code handling

The current Stripe coupon system (applied at the subscription level) naturally applies
across all line items. A 50%-off coupon for a school discounts both SubHub and Campus Lock.
This is the right behavior. No changes needed for promos.

---

## 5. IT PLATFORM VISION

### Current SubHub platform

SubHub's `(platform)` route group at `/platform` already does:
- Org index table with billing status, seat count, trial days
- Per-org management: billing timeline, check payment entry, user management,
  "View as Admin" impersonation, plan notes
- IT Staff management (invite, online presence detection)
- Email reference and onboarding guide
- Discount request card (PROMO: in planNotes)

This is a solid foundation. The multi-product IT Platform is an evolution, not a rebuild.

### What the Homebase IT Platform adds

**Cross-product org view** (`/platform/[orgId]`)
The existing page shows billing/users. Add a "Products" tab showing:
- Which products are active, their status, unit counts, last billing event
- "Activate Product" button (creates the `org_products` row and Stripe subscription item)
- "Deactivate Product" button (cancels that subscription item)
- Per-product settings override (e.g., force-enable a product for a trial org)

**Product health dashboard** (`/platform/products`)
- SubHub: today's blast status (sent/filled/pending) across all orgs
- Campus Lock: today's check-in completion rate across all orgs
- Alerts: orgs with failed blasts, orgs with stuck check-ins, billing failures

**Cross-product impersonation**
The current impersonation system (`impersonate_org_id` cookie) routes to `/dashboard`
(SubHub admin portal). Extend it: the "View as Admin" button shows a product picker if
the org has multiple products active. Clicking SubHub sets the cookie and routes to
`/dashboard`; clicking Campus Lock routes to `/campus-lock/admin`.

**Unified billing controls**
Platform staff can currently enter check payments and update billing status per org.
Add: per-product seat/unit adjustments, cross-product coupon application, and the
ability to comp one product while charging for another.

### What stays the same

- The `subhub-platform` org slug and its special properties (no billing gate, no blasts,
  `isPlatformAdmin` flag)
- The `getEffectiveOrgId()` pattern in `src/lib/impersonation.ts`
- The `ImpersonationBanner` component
- Dark theme for the platform portal (visual separation from customer-facing UI)

---

## 6. SCALE ASSESSMENT

### Row counts at scale

A concrete estimate:

| Entity | Per school avg | 100 schools | 1,000 schools |
|--------|---------------|-------------|---------------|
| Users (teachers/staff/subs) | 60 | 6,000 | 60,000 |
| Students (Campus Lock) | 400 | 40,000 | 400,000 |
| Absence records/year | 500 | 50,000 | 500,000 |
| Sub assignments/year | 400 | 40,000 | 400,000 |
| Notification tokens/year | 2,000 | 200,000 | 2,000,000 |
| Campus Lock check-ins/year | 90,000 | 9,000,000 | 90,000,000 |

SubHub-only at 1,000 schools: well under 5 million total rows across all tables.
This is trivially small for Postgres. Not a scale concern for SubHub.

Campus Lock check-ins at 1,000 schools: 90 million rows/year is the first real table
size concern. At 3 years of data: 270 million rows. Postgres handles this fine with
proper indexing (school_id, date) and periodic archival of records > 2 years old.

### Supabase-specific limits

**Connection pooling.** Supabase uses PgBouncer (transaction mode) for the pooled
`DATABASE_URL`. On the Pro plan: ~200 total connections. At 1,000 schools with active
users, peak concurrent Vercel function instances could hit this. Mitigation:
- Vercel Fluid Compute reuses function instances — fewer cold starts, fewer connections
- Connection pool is already used (the DATABASE_URL in SubHub is the pooled URL)
- At 500+ schools, move to Supabase's newer Supavisor (session mode) or upgrade to
  Enterprise connection limits

**RLS performance.** RLS is enabled but has no policies — access is all at the service role
layer via Drizzle. Zero RLS evaluation overhead. This is a strong design choice. Do not add
row-level policies; the application layer handles org isolation.

**Supabase Auth limits.** Supabase Pro supports 100,000 MAU. At 1,000 schools × 100 staff
+ subs, that's 100,000 users. You'd be right at the limit. At 1,000+ schools or with student
accounts: upgrade to Team/Enterprise tier. Note: students probably don't need Supabase auth
accounts (they don't log in; parents do). Parent accounts are a fraction of student count.

**Supabase Storage.** Attachment storage (lesson plans, resumes, avatars) scales linearly.
At 50KB per attachment, 5 attachments per absence, 500 absences/school/year, 1,000 schools:
125 GB/year. Supabase Pro includes 100GB; storage overages are $0.021/GB. Budget ~$25/mo
for storage at that scale. Not a concern.

**Realtime.** Campus Lock geofence check-ins may need real-time push to admin dashboards
(e.g., "who's on campus right now"). Supabase Realtime has a concurrent connection limit
(100 on Free, 500 on Pro). If admins have dashboards open watching live check-ins, this
limit hits quickly at 100+ schools. Options: use polling instead of Realtime for admin
dashboards, or upgrade. This is a Campus Lock-specific architecture decision, not a
Homebase concern right now.

### When to consider splitting

**First 100 schools:** One Supabase project, no changes. Current architecture scales fine.

**100–500 schools:** Monitor: connection pool utilization (visible in Supabase dashboard).
Upgrade to Pro if not already. Enable Supabase read replicas for report-heavy queries
(payroll reports, fill rate analysis). No architectural changes required.

**500–1,000 schools:** Evaluate: Is Campus Lock generating millions of check-in rows?
If so, consider moving Campus Lock's high-volume tables (`cl_check_ins`, `cl_attendance_records`)
to a separate Postgres instance (separate Supabase project or dedicated RDS). Core tables
stay in the original project. This is a data partitioning decision, not an auth split.

**1,000+ schools:** At this scale, a multi-tenant SaaS architecture review is warranted.
Options include: vertical scaling (larger Supabase plan), read replicas, or separating
products onto dedicated Supabase projects (shared auth via custom JWT or Supabase federated auth).
However, 1,000 private K-12 schools is a very large market share for this niche — the more
immediate constraint at that scale will be support and onboarding capacity, not database rows.

### Recommended approach

**For the first 100 schools (current phase):** Single Supabase project, shared schema, no
sharding. Focus on code quality and product-market fit. The database is not the bottleneck.

**For Campus Lock development:** Add product tables to the same Supabase project. Use `cl_`
prefix for all Campus Lock tables. Do not create a separate Supabase project — shared auth
is the core value of a unified platform, and cross-project auth is complex.

**For 1,000+ schools (future consideration):** Revisit connection pooling and read replica
strategy. The architecture decision at that point depends on actual query patterns.

---

## 7. MIGRATION PATH

### Guiding principle

Homebase is not a rebuild — it's a series of targeted additions to what SubHub already
has. SubHub should continue to work exactly as it does today throughout this migration.
All changes are additive until the billing column move (which can be done in a maintenance
window).

### Phase 0: Prerequisite decisions (before writing any code)

These design questions need answers before any migration work begins:

1. Will Campus Lock share the SubHub Supabase project or start separate?
   **Recommendation:** Same project. (See auth and scale reasoning above.)
2. Will Campus Lock be built in the same Next.js repo (monorepo) or a separate one?
   This affects routing and deployment but not the database design.
3. Is the role enum change (removing `teacher`/`substitute`) worth the SubHub migration
   cost right now, or can it be deferred? **Recommendation:** Defer until a slow period —
   it's a non-trivial migration that doesn't unlock anything immediately.

### Phase 1: Add core product infrastructure (estimated 1–2 days, zero SubHub breakage)

These are purely additive changes. SubHub keeps working unchanged.

1. **Add `products` table.** Insert one row: `{ slug: 'subhub', name: 'SubHub', ... }`.
   No code changes required yet.

2. **Add `org_products` table.** Migrate existing billing data: for every org with
   `subscription_status != null`, insert an `org_products` row with `product_id = subhub`,
   mirroring the current billing fields. SubHub billing code still reads `organizations`
   for now (the `org_products` rows are "shadow" data until Phase 3).

3. **Add `students` and `student_school_enrollments` tables.** Empty for now. Their
   existence in the schema allows Campus Lock development to begin without waiting.

4. **Drizzle schema update.** Add the new tables to `src/db/schema.ts`. Generate migration.
   Apply in Supabase SQL editor. No application code changes.

### Phase 2: Move SubHub-specific org fields to product settings tables (estimated 2–3 days)

This is the messiest step because it touches every SubHub server action that reads
notification/pay settings from `organizations`.

1. **Create `subhub_org_settings` table** with all SubHub-specific org fields
   (`auto_notify_subs`, `notify_by_sms`, `notify_by_email`, `notify_by_phone`,
   `sub_pay_model`, `half_day_hours`, `full_day_hours`, `cron_enabled`).

2. **Data migration:** For every org, copy the current values from `organizations`
   into a new `subhub_org_settings` row.

3. **Code migration:** Update all server actions and notification code that read these
   fields to query `subhub_org_settings` instead of `organizations`. Key files:
   - `src/lib/notifications.ts` (reads `org.cronEnabled`, `org.notifyByEmail`, etc.)
   - `src/app/(app)/settings/actions.ts` (writes these fields)
   - `src/app/api/blast/*/route.ts` (reads org settings)
   - `src/app/(app)/admin/actions.ts` (may read notification settings)

4. **Remove columns from `organizations`** once all code is updated.
   Drop columns: `auto_notify_subs`, `notify_by_sms`, `notify_by_email`, `notify_by_phone`,
   `sub_pay_model`, `half_day_hours`, `full_day_hours`, `cron_enabled`.

5. **Repeat for `subhub_school_settings`:** Move `priority_calling_enabled` and
   `times_configured` from `schools` to a `subhub_school_settings` table.

**Estimated effort:** 6–10 files to update. A full afternoon of focused work.
**Risk:** Medium. Touching `notifications.ts` and the blast routes requires careful testing
to ensure no notification regressions.

### Phase 3: Migrate billing columns to `org_products` (estimated 1 day)

These fields move from `organizations` to `org_products`:
- `subscription_status` → `org_products.status`
- `paid_through` → `org_products.paid_through`
- `stripe_subscription_id` → stays on `organizations` (it's the subscription container,
  not product-specific)
- `seat_count`, `pending_seat_count`, `pending_seat_update_at` → `org_products.unit_count`,
  `pending_unit_count`, `pending_unit_update_at`
- `stripe_customer_id` → stays on `organizations`

Update `src/lib/billing.ts`, `src/app/api/stripe/webhook/route.ts`,
`src/app/api/stripe/checkout/route.ts`, `src/app/(app)/layout.tsx` (billing gate),
`src/app/(billing)/billing/page.tsx`, and `src/app/api/cron/seat-auto-commit/route.ts`.

Also move `price_per_seat_cents` and `stripe_price_id` from `platform_settings` to the
`products` table row for SubHub.

**Estimated effort:** 1 focused day. High surgical precision required.
**Risk:** High — billing is money. Requires thorough testing in local dev with test Stripe keys
before deploying. Best done during a low-activity window (weekend morning).

### Phase 4: Expand role enum and update portal routing (estimated half-day; can defer)

1. Remove `teacher` and `substitute` from `roleEnum`. Add `member` as a neutral fallback
   if needed. Teachers and subs become `staff` at the org level (or `member`).
2. Update `/auth/portal` routing: check `employees` row to route to `/teacher`;
   check `substitutes` row to route to `/sub/dashboard`.
3. Update any code that filters `WHERE role = 'teacher'` to instead join `employees`.

**Can this be deferred?** Yes, until Campus Lock adds roles that conflict with the existing
enum. As long as only SubHub exists, the current role enum causes no problems.

### Phase 5: Campus Lock development (ongoing, parallel)

Campus Lock development can begin after Phase 1 is complete (students table exists).
It does not need Phases 2–4 to proceed. Campus Lock:
- Creates its own tables (prefixed `cl_`) in the same Supabase project
- References core tables (`organizations`, `campuses`, `schools`, `users`, `students`)
- Gets its own Next.js route group in the same or a separate repo
- Migrates from custom JWT to Supabase Auth (run in parallel with feature development)

### Phase 6: IT Platform expansion (after first dual-product school exists)

Only worthwhile when at least one school has both SubHub and Campus Lock. At that point:
- Add "Products" tab to `/platform/[orgId]`
- Build product activation/deactivation UI
- Add product health widgets to the platform dashboard

### What can be deferred vs. what must happen upfront

**Must happen before Campus Lock shares the database:**
- Phase 1 (products + students tables) — so Campus Lock schema has a home

**Should happen before Campus Lock ships:**
- Phase 2 (SubHub settings extracted) — reduces coupling, makes the schema cleaner
- Campus Lock's custom JWT migration to Supabase Auth — enables cross-product SSO

**Can be deferred until a second school buys both products:**
- Phase 3 (billing column migration) — no impact until billing needs to handle two products
- Phase 6 (IT Platform expansion) — cosmetic until multi-product orgs exist

**Can be deferred indefinitely (low value for near-term):**
- Phase 4 (role enum cleanup) — no functional impact, cosmetic schema improvement

---

## 8. RISKS AND OPEN QUESTIONS

### Risks

**1. Schema migration during live school year**
SubHub's first customer (Southlands Christian) is in active use. Phases 2 and 3 touch
billing and notification code. A bug in Phase 3 (billing column move) could break billing
enforcement or Stripe webhooks. Mitigation: do these phases during summer break, maintain
a rollback plan (re-add columns and revert code in one commit), and test thoroughly in
local dev first.

**2. Role enum migration breaks existing user records**
If you drop `teacher` and `substitute` from the PostgreSQL enum, you must first update
all existing rows. There are likely hundreds of teacher and substitute user records already.
A botched migration could lock users out. Mitigation: do a dry-run count query, write the
migration as a transaction, and have a rollback ready.

**3. Shared database creates cross-product blast risk**
The `cron_enabled` field (currently on `organizations`, moving to `subhub_org_settings`)
is the notification kill switch. If the migration misses any blast code that still reads
the old column location, a school could receive or not receive notifications unexpectedly.
Mitigation: grep every blast-related file before deploying Phase 2.

**4. Connection pool exhaustion with Campus Lock real-time features**
Campus Lock geofencing may require frequent DB writes (student check-in/out events, device
heartbeats). If Campus Lock generates 10 writes/second at 100 schools, that's 1,000 writes/sec
— well within Postgres capacity, but may stress the PgBouncer connection pool if each write
opens a new connection. Mitigation: use connection pooling correctly (SubHub already does);
batch check-in writes where possible; monitor pool utilization in Supabase dashboard.

**5. Single Supabase project means shared failure domain**
A Supabase outage takes down all products simultaneously. For SubHub alone, this is
acceptable. Once Campus Lock is managing student safety on campus, the stakes are higher.
Mitigation: ensure Supabase's status page is monitored; design Campus Lock to have a
graceful degraded mode (cached last-known states) when the database is unreachable.

**6. Stripe one-subscription model breaks if products have different billing cycles**
The proposal assumes all products bill monthly. If Campus Lock is ever priced annually
(schools prefer annual commitments), putting it on the same monthly subscription as
SubHub creates invoice confusion. Mitigation: enforce same billing cycle across products,
or allow separate subscriptions when cycles differ.

### Open questions

**1. Is Campus Lock in the same Next.js repo or a separate one?**
Arguments for same repo: shared components (auth, navigation, billing pages), one deploy,
easier cross-product navigation. Arguments for separate repo: independent deployments,
clear product boundaries, smaller builds. This is the most consequential near-term decision
— it affects file organization, routing, and build pipelines.

**2. Who manages Campus Lock students — school admins or a separate campus admin?**
If Campus Lock students are managed by the same admin who manages SubHub teacher absences,
the shared `(app)` route group can extend to cover both. If Campus Lock has a separate
administrative role (campus safety director vs. HR admin), a separate route group and
portal is cleaner.

**3. Do parents get Supabase auth accounts for Campus Lock?**
Parents receiving push notifications don't need accounts. Parents viewing their child's
attendance history do. The answer determines whether students need to be added to the
users table or just the students table. Defer this decision until Campus Lock's parent
feature is defined.

**4. How does the seat count model work for Campus Lock?**
SubHub's 48-hour seat management window works well for slowly-changing teacher rosters.
Student enrollment changes are more frequent (new students mid-year, transfers out).
Should Campus Lock use the same 48-hour window, a monthly snapshot, or live metered billing?
This affects the Campus Lock billing implementation significantly.

**5. Does `schoolDirectory` serve Campus Lock?**
The `school_directory` table (3,194 CA schools with lat/lng) could be extremely useful for
Campus Lock geofence setup — prepopulate the school's boundary from the address + GPS
coordinates. No code changes needed; just document that Campus Lock should use this table.

**6. What happens to `platform_settings.app_name`?**
Currently set to 'SubHub'. With multiple products, there's no single "app name". This
field should be renamed to `company_name` or `platform_name` and represent the IT vendor
identity ("SubHub" → eventually "Homebase" if that becomes the brand), not a product name.
Low priority, but rename it before Campus Lock ships to avoid confusion.

### Trade-offs: shared core vs. separate apps

| Concern | Shared core | Separate apps |
|---------|-------------|---------------|
| Cross-product SSO | Automatic (same auth.users) | Complex (OAuth between apps) |
| Shared org/school data | One source of truth | Duplicate, risk of drift |
| One monthly invoice | Natural | Requires billing coordination |
| Schema coupling | Possible if not disciplined | Clean isolation |
| Deployment coordination | One deploys both | Independent |
| Onboarding a new school | One account, add products | Separate accounts, separate logins |
| If one product has outage | Shared failure domain | Isolated |
| Campus Lock real-time data | Same DB, potential contention | Isolated scaling |

**Verdict:** For a two-to-three product suite targeting the same schools, the shared core
approach wins significantly on SSO, billing, and onboarding simplicity. The coupling risk
is real but manageable with disciplined naming conventions (table prefixes, separate settings
tables) and code review. Separate apps only make sense if Campus Lock grows to a scale that
requires its own Supabase project — and at that point, the migration path exists.

---

_This plan should be reviewed and updated as each phase is completed and as Campus Lock
requirements are further defined. The most important next step is deciding whether Campus
Lock shares the SubHub Next.js repo (same code deployment) or lives separately._
