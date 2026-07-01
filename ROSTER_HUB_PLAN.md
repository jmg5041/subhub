# Roster Hub — The Anchor Database

_Status: **Committed direction** (decided & refined 2026-06-30 → 2026-07-01). Full design
spec. No code written yet._

_This is the authoritative, cross-machine description of how SubHub, HallLocker, and any
future product share roster/identity data. It supersedes the "shared live tables" approach in
`HOMEBASE_PLAN.md`. Read alongside `STRATEGIC_CONTEXT.md`. The HallLocker-specific view is in
`student-monitor-app/ROSTER_HUB_INTEGRATION.md`._

---

## 1. The decision, in one paragraph

We are building a **roster hub** — a standalone "anchor" database that holds the shared roster
and identity for a customer (district → campuses → schools → adults → students). Each product
(SubHub, HallLocker, future) keeps **its own separate database** and **pulls a one-way copy**
of the roster it needs. Products never write roster back to the hub. This is the pattern Clever
and ClassLink use in K-12: connect the roster once (CSV now, SIS later), push it to every
downstream app. Billing stays entirely inside each product; the hub is billing-neutral.

---

## 2. Vocabulary (agreed terms)

| Term | Means | Notes |
|------|-------|-------|
| **Organization** = **District** | The paying customer. The identity container and the single billing relationship. | Same thing, two words. SubHub's `organizations` table already carries `districtName`; "one org = one district = one Stripe subscription." Scales down to a one-site private school (org = the school itself). |
| **Campus** | A physical location (address). The **geofence** unit for HallLocker. | One org can have many campuses. |
| **School** | A named division (ES / MS / HS). The unit of **product activation**. | Schools live under a campus. |
| **People** | Adults: admin, principal, staff, teacher, substitute. | One `people` table, distinguished by role. A SubHub teacher and a HallLocker teacher are the **same** hub person. |
| **Students** | K-12 students. | Their own table (different shape than adults). SubHub never pulls this; HallLocker does. |
| **Product activation** | A per-product on/off list of `(product, school)`. Governs which schools a product operates on and pulls roster for. | Independent per product. Does **not** compute billing (§6). |
| **`anchor_id`** | The hub's permanent UUID for an entity, stored on the product's copy. | The join key for all sync. |

---

## 3. The one rule everything flows from

> **Products point *at* the hub. The hub never points *at* a product.**

This shows up as two arrows that always agree:

- **Pointer (foreign key):** product rows hold the hub's ID → `product ──▶ hub`
- **Data flow (sync):** roster copies out of the hub → `hub ──▶ product`

Both encode the same fact: **the hub is the source of truth; products are downstream
consumers.** From that single principle:

| Guarantee | Why it holds |
|-----------|--------------|
| **Clean peel-away (sell a product)** | Snapshot the hub rows + that product's tables, hand them over. The hub never referenced the product, so nothing dangles. |
| **No dead appendage (kill a product)** | `DROP` the product's tables. The hub doesn't notice — it never pointed at them. |
| **No sync conflicts** | Data only flows hub → product. The hub always wins. No bidirectional merge to resolve. |
| **No blast radius** | A bug in one product can only corrupt that product's own tables. It has no path into another product's data or the hub's roster. |

**Separation is always a copy event.** While we own two products for the same school, they
share the hub for convenience. If we ever *sell* one, that's a one-time snapshot export and the
two go their separate ways. We never share a live database across an ownership boundary.

---

## 4. The three-layer model (organization / campus / school + activation)

The key insight that resolved every mixed-purchase scenario: **"whose roster is this?" and
"what did they buy?" are two different questions.** Keep the roster container fixed at the org;
express purchases as a separate activation switch.

| Layer | Purpose | Granularity |
|-------|---------|-------------|
| **Organization (district)** | Paying customer + identity container + billing relationship | One per customer |
| **Campus** | Physical location — the geofence unit | Where people physically are |
| **School** | The unit of **product activation** — "is SubHub on here? is HallLocker on here?" | ES / MS / HS |

**A product's customer account maps to the hub ORGANIZATION** (not a school). What they bought
is expressed as **school-level product activation** — a per-product list of which schools are
switched on. Campus stays purely physical.

### Worked scenarios (all validated)

1. **1 campus, 3 schools, SubHub for all 3.** Org=1, campus=1, schools=3. SubHub activation =
   {ES, MS, HS}.
2. **District, 5 campuses; 2 campuses buy SubHub, 1 buys HallLocker.** Org=1 (the district).
   SubHub activation = schools under campuses 2 & 3. HallLocker activation = schools under
   campus 1. Each product only pulls and bills for its activated schools.
3. **Southlands: 1 campus, 3 schools; HallLocker for HS only, SubHub for all 3.** Org=1. SubHub
   activation = {ES, MS, HS}; HallLocker activation = {HS}. The HS teacher is **one** hub person
   both products pull. HS students check into the shared **campus** geofence even though
   HallLocker is only "on" for the HS. *(This is the scenario that proves org-as-container: you
   could not express it if the account mapped to a school.)*
4. **Real district, 15 elementary schools, only 1 buys.** Org=1 (the district). Activation =
   {that 1 school}. The other 14 are simply not activated — not pulled, not billed. If more
   join later, it's a **toggle**, not a new account: same org, same login, same Stripe customer.

---

## 5. What lives in the hub vs. in a product

The test for every field/table: **"Is this a fact about *who* the person/school is (hub), or a
fact about *how one product treats them* (product)?"**

- **Hub** = shared roster & identity: org → campus → school hierarchy, adults, students,
  who-belongs-where, and (v2) academic structure (classes, sections, periods).
- **Product** = operational data: SubHub's absences, sub-priority order, tokens; HallLocker's
  geofences, campus building check-in points, attendance/tardy events, presence, hall passes,
  device data, restriction policies. These **never** go in the hub. They *reference* hub records
  by `anchor_id` (e.g. a HallLocker geofence references a hub campus), but the operational rows
  themselves stay local.

---

## 6. Billing — per product, from the product's own database (hub is neutral)

**Each product computes its own bill from its own database.** SubHub bills the number of
teachers an admin has actually entered into SubHub; HallLocker bills the number of students in
HallLocker. Add a teacher in SubHub → bill up; remove one → bill drops next month. This is
already how SubHub works (seat count, 48-hour commit window, Stripe quantity sync).

**The hub/SIS never counts anyone or drives a charge.** A pull may *add* people into a product,
but the billable number is whatever lives (and stays) in that product's own DB — under the
admin's control. Product activation (§4) governs *which schools a product operates on and pulls
for*; it is **not** the invoice. The product DB is always the source of truth for money.

---

## 7. The anchor is a set of tables, not one wide table

Different entities have different shapes. Internal foreign keys among hub tables are fine (a
student points at a school, a school at a campus, a campus at an org). The "no FK out" rule only
governs the boundary *between the hub and a product*.

**v1 — core identity/roster (build first):**
```
organizations       ← district / paying entity
campuses            ← physical locations (addresses); the geofence anchor
schools             ← named divisions (ES/MS/HS) under a campus
people              ← ADULTS: admin, principal, staff, teacher, substitute (role column)
staff_assignments   ← junction: which adult works at which school (+ type)
students            ← K-12 students (SubHub never pulls this; HallLocker does)
enrollments         ← junction: which student is at which school (+ year)
product_activations ← registry: (product, organization, school) on/off  [entitlement, not roster]
```

**v2 — academic structure (add when a product needs it; SIS-fed):**
```
periods             ← bell schedule / period definitions
courses             ← course catalog
sections            ← a class section: course + teacher + room + period
section_rosters     ← junction: which student is in which section
```
_Rationale for putting academic structure in the hub (not a product): it's genuine SIS master
data, and more than one product may consume it (Jesse may add a third product that pulls student
+ class data). Staged as v2 so v1 stays lean._

**Future:** `guardians` (parent/guardian contacts for HallLocker parent features).

---

## 8. The permanent `anchor_id` (the backbone)

The hub mints a stable UUID for every entity — its `id` *is* the anchor ID. Every product row
that came from the hub stores that ID in a nullable **`anchor_id`** column. Products match on
`anchor_id`, never on name/email. Sync becomes a safe upsert: "here are the people with these
anchor IDs — insert or update." This permanently solves the "is Bob the same as Robert?"
matching problem: match on ID.

Rows created before the hub exists (or for single-product customers who never use the hub) have
`anchor_id = null` and are managed locally, exactly as today.

---

## 9. Two axes of "pull only what you need"

Each product declares (a) **which tables** it consumes and (b) **which columns** within each.

| Hub table | SubHub | HallLocker | Future |
|-----------|:------:|:----------:|:------:|
| organizations / campuses / schools | ✓ | ✓ | ✓ |
| people (adults) | ✓ | ✓ (teachers) | ✓ |
| staff_assignments | ✓ | maybe | ✓ |
| students | **—** | ✓ | ✓ |
| enrollments | **—** | ✓ | ✓ |
| sections / section_rosters / periods (v2) | **—** | ✓ | ✓ |

**Adding columns/tables to the hub never breaks existing products** — a pull is a projection
(`SELECT` named columns); new columns downstream change nothing. The hub can widen for years,
one product at a time.

---

## 10. First-draft v1 schema (derived from SubHub's real columns)

Product-operational fields are intentionally excluded. `source` and `sis_id` anticipate SIS
import; `updated_at` supports incremental "only sync what changed" pulls.

```
organizations
  id uuid PK   name   district_name   timezone
  source ('csv'|'sis'|'manual')   sis_id   updated_at

campuses
  id uuid PK   organization_id → organizations.id
  address city state zip phone   source sis_id updated_at

schools
  id uuid PK   organization_id → organizations.id   campus_id → campuses.id
  name   address city state zip county phone website   grade_range
  source sis_id updated_at
  -- NOT in hub: dayStartTime, timesConfigured, priorityCallingEnabled (SubHub ops)

people                        ← ADULTS only
  id uuid PK   organization_id → organizations.id
  first_name last_name email phone
  role ('admin'|'principal'|'staff'|'teacher'|'substitute')
  primary_school_id → schools.id (nullable)   status   employee_number (nullable)
  source sis_id updated_at
  -- NOT in hub: isPlatformAdmin, avatarUrl, emailBounced, sub skills/rating (product)

staff_assignments             ← mirrors SubHub 'employees'
  id uuid PK   person_id → people.id   school_id → schools.id
  employee_type ('Teacher'|'Staff'|'Admin')   status   source updated_at

students                      ← HallLocker pulls this; SubHub never does
  id uuid PK   organization_id → organizations.id   primary_school_id → schools.id
  student_number   first_name last_name   email (nullable)
  grade_level (text)   date_of_birth (nullable)   status   source sis_id updated_at

enrollments                   ← student ↔ school (+ year)
  id uuid PK   student_id → students.id   school_id → schools.id
  school_year ('2026-2027')   grade_level   status   source updated_at

product_activations           ← entitlement registry (not roster)
  id uuid PK   product ('subhub'|'halllocker'|...)
  organization_id → organizations.id   school_id → schools.id
  active (bool)   activated_at   deactivated_at
```

---

## 11. How data gets in and out

```
        CSV upload ──┐
                     ├──▶  ROSTER HUB  ──▶ SubHub     (pull: orgs/campuses/schools/people)
   SIS sync (later)──┘   (source of truth) ──▶ HallLocker (pull: + students/enrollments/sections)
                                              ──▶ Product #3 (pull: all)
```

- **CSV first.** Customers with 2+ products upload roster CSVs into the hub. Each product has a
  "Pull from roster hub" action that upserts by `anchor_id`.
- **SIS later — purely additive.** A future SIS connector (PowerSchool / Aeries / Schoology) is
  just another *input* into the hub. Products pull from the hub regardless of whether it was fed
  by CSV or SIS. Nothing downstream changes when SIS is added. (HallLocker already stores
  `powerschool_url` / `schoology_client_id`, so it's SIS-aware.)
- **Single-product customers skip the hub entirely.** A school that only buys SubHub uploads its
  CSV straight into SubHub, exactly as today. No hub required until they own a second product.
- **Keep each product's existing importer.** The hub "pull" terminates in the *same* import code
  path the product already has — the hub becomes just another *source* feeding that importer,
  plus a permanent manual fallback. Not a competing system.

---

## 12. Sync direction — one-way, no conflict engine

Roster flows **hub → product only**. Products may hold local-only fields the hub never touches
(SubHub sub priority, HallLocker device info) — safe, because the pull only overwrites the
columns it maps. There is **no** bidirectional merge and **no** "resolve conflicts" UI, by
design. Corrections are made in the hub and flow down on the next pull.

---

## 13. Product mapping summary

**SubHub** pulls: organizations, campuses, schools, people (adults), staff_assignments. Never
students. Its account ↔ hub organization. Billing = live teacher count in SubHub's own DB.

**HallLocker** (see `student-monitor-app/ROSTER_HUB_INTEGRATION.md` for detail):
- Account ↔ hub **organization**. Schools = activation units; campus = geofence unit.
- Pulls: organizations, campuses, schools, people (teachers), students, enrollments, and (v2)
  sections / section_rosters / periods for per-class attendance.
- **The same teacher is one hub `people` row shared with SubHub** — enter/update once, both pull.
- HallLocker-local (never in hub): geofences, **campus building check-in points**, attendance /
  tardy events, presence, hall passes, device tokens, restriction policies. These reference hub
  campus/school by `anchor_id` but stay local.
- Add nullable `anchor_id` to its `schools` (→ hub org), `users` (→ hub people), `students`
  (→ hub students). Billing = live student count in HallLocker's own DB.

---

## 14. Next stages (execution order)

**(a) Modify SubHub as necessary** — additive, non-breaking; single-product customers unaffected.
- [ ] Add nullable `anchor_id uuid` to `organizations`, `campuses`, `schools`, `users`
      (and consider `employees` → `staff_assignments`). Migration: generate SQL with
      `drizzle-kit generate`, run it in the Supabase SQL editor — **never `drizzle-kit push`**.
- [ ] Confirm SubHub's existing CSV importer can be reused as the "landing code" a hub pull calls.
- [ ] No behavior change for customers who don't use the hub (`anchor_id` stays null).

**(b) Build the roster hub.**
- [ ] Decide hosting: **separate Supabase project** for the hub (leaning — maximum isolation,
      cleanest peel-away) vs. a schema inside the existing project.
- [ ] Create v1 core tables (§10). Mint `anchor_id`s. Add `product_activations`.
- [ ] Build CSV-into-hub import.

**(c) Test import/sync in SubHub, then go live.**
- [ ] Seed the hub with Southlands' roster.
- [ ] Run SubHub "Pull from roster hub"; verify upsert by `anchor_id`, no duplicate teachers,
      no disruption to existing SubHub data or billing.
- [ ] Ship the hub-capable SubHub to production (it's already live; these changes are additive).
      The hub remains optional until a customer owns a second product.

**Later:** SIS connectors (additive input to the hub); v2 academic tables when HallLocker needs
per-class attendance; `guardians` for parent features; optional shared billing service.

---

## 15. Naming note

- **SubHub** — substitute management. Live.
- **HallLocker** — student phone management (formerly "Campus Lock" / "student monitor app").
  Tentative rebrand; likely acquiring `halllocker.com` / `.org` / `.net`. Confirm before using
  the name in code.
- **Roster hub / anchor** — the shared roster database described here. Not customer-facing.
