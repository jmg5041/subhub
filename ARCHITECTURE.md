# SubHub Architecture

Four diagrams showing how the system fits together.

---

## 1. Portal Map — Who Goes Where

Every user who logs in is routed to one of six portals based on their role.

```mermaid
flowchart TD
    LOGIN["/auth/login\nEmail/password or Google SSO"]
    PORTAL["/auth/portal\nRoute handler — reads role from DB"]

    LOGIN --> PORTAL

    PORTAL -->|isPlatformAdmin = true| PLATFORM["🔧 /platform\nIT Staff Dashboard\nDark theme\nAll orgs, billing, impersonation"]

    PORTAL -->|role = district| DISTRICT["🏛 /district\nDistrict Dashboard\nRead-only: campuses, schools,\nabsence stats"]

    PORTAL -->|role = admin\nprincipal\nstaff| APP["🏫 /dashboard\nAdmin Portal\nAbsences, subs, reports,\nusers, schools, billing"]

    PORTAL -->|role = teacher| TEACHER["👩‍🏫 /teacher\nTeacher Portal\nSubmit absence requests\nView own history"]

    PORTAL -->|role = substitute| SUB["📋 /sub/dashboard\nSub Portal\nView jobs, accept/decline\nSet availability"]

    PORTAL -->|onboardingCompletedAt\n= null| ONBOARDING["🧙 /onboarding\nSetup Wizard\nDistrict → Campus → Schools\n→ Billing → Finish"]

    APP -->|impersonate cookie set| APP
    PLATFORM -->|View as Admin button| APP
```

---

## 2. Auth Flow — From Signup to Dashboard

```mermaid
sequenceDiagram
    participant Browser
    participant Supabase
    participant Portal as /auth/portal
    participant DB as Postgres (Drizzle)
    participant IT as IT Staff (email)

    Browser->>Supabase: POST /auth/signup (name, orgName, email, password)
    Supabase-->>Browser: Confirmation email sent
    Browser->>Supabase: Click confirmation link
    Supabase->>Portal: Redirect with session
    Portal->>DB: Look up users row by auth ID
    Note over Portal,DB: Not found + selfSignup flag = new org
    Portal->>DB: provisionSelfSignupOrg()
    DB-->>DB: INSERT organizations (120-day trial)
    DB-->>DB: INSERT users (role=admin)
    DB-->>DB: INSERT absence_reasons (9 defaults)
    Portal->>IT: Email alert "New signup: [School]"
    Portal-->>Browser: Redirect → /onboarding

    Note over Browser: Completes 4-step wizard
    Browser->>Portal: onboardingCompletedAt set
    Portal-->>Browser: Redirect → /dashboard
```

---

## 3. Core Data Flow — Absence to Coverage

```mermaid
flowchart TD
    subgraph CREATE["Create Absence"]
        T[Teacher submits\nabsence request] --> ABS[teacher_time_off row\nstatus: unapproved]
        ADMIN[Admin creates\non behalf of teacher] --> ABS
    end

    subgraph APPROVE["Approve"]
        ABS --> REVIEW[Admin reviews\n/absences/approve]
        REVIEW -->|Approve| APPROVED[status: approved\nsubOutreachStatus: not_started]
        REVIEW -->|Deny| DENIED[status: denied]
    end

    subgraph NOTIFY["Find a Sub"]
        APPROVED -->|Auto-notify ON| DISPATCHER
        APPROVED -->|Manual| FINDSUB[Admin clicks\nNotify All Subs]
        FINDSUB --> DISPATCHER

        DISPATCHER["QStash Dispatcher\nRuns every 5 min\n/api/dispatcher"] --> BLAST["Blast routes\n/api/blast/evening\n/api/blast/morning\n/api/blast/reblast"]

        BLAST -->|Per sub in priority order| TOKEN[sub_notification_tokens\nUUID + 48h expiry]
        TOKEN --> EMAIL[Email to sub\nAccept / Decline links]
        TOKEN --> SMS[SMS to sub\nTwilio]
        TOKEN --> IVR[Phone call\nTwilio IVR]
    end

    subgraph ACCEPT["Sub Accepts"]
        EMAIL -->|/sub/jobs/token?action=accept| ACCEPT_LOGIC["sub-job-logic.ts\nperformAcceptJob()"]
        IVR --> ACCEPT_LOGIC
        ACCEPT_LOGIC --> ASSIGN[sub_assignments row\nstatus: confirmed]
        ASSIGN --> FILLED[subOutreachStatus: filled\nOther tokens invalidated]
    end

    subgraph COMPLETE["After the Day"]
        FILLED --> CRON["Complete cron\n5:30pm local time\nSets completedAt"]
        CRON --> RECONCILE[Admin reconciles\n/absences/reconcile\nConfirms hours]
        RECONCILE --> REPORT[Sub Pay Report\n/reports/sub-pay]
    end
```

---

## 4. Key File Map

```mermaid
flowchart LR
    subgraph SCHEMA["Data Layer"]
        S[("src/db/schema.ts\nAll 20+ Drizzle tables\norgs, campuses, schools,\nusers, absences, subs,\nbilling, platform")]
        IDX["src/db/index.ts\nDrizzle client\n(postgres superuser\nbypasses RLS)"]
        S --- IDX
    end

    subgraph AUTH["Auth"]
        MID["src/lib/supabase/middleware.ts\nSession refresh\nRoute protection"]
        CB["/auth/callback\nPKCE flow handler"]
        CONF["/auth/confirm\nImplicit flow\n(invite emails)"]
        PORT["/auth/portal\nRole-based redirect\nprovisionSelfSignupOrg()"]
    end

    subgraph PORTALS["Route Groups → Layouts"]
        APP_L["(app)/layout.tsx\nBilling gate\nOnboarding gate\nNotices count\nImpersonation"]
        PLAT_L["(platform)/layout.tsx\nisPlatformAdmin check"]
        TEACH_L["(teacher)/layout.tsx"]
        SUB_L["(sub)/layout.tsx"]
        DIST_L["(district)/layout.tsx\ndistrict role check"]
        OB_L["(onboarding)/layout.tsx"]
    end

    subgraph ACTIONS["Server Actions (key files)"]
        AA["(app)/absences/actions.ts\nAbsence CRUD\nSub assignment\nBlast trigger"]
        ADM["(app)/admin/actions.ts\nUser invite/import\nSchool management\nSub roster"]
        PLAT_A["(platform)/platform/actions.ts\nOrg management\nBilling records\nDelete org"]
        OB_A["(onboarding)/onboarding/actions.ts\nCampus creation\nSchool creation\nDiscount requests"]
    end

    subgraph CRON["Cron & Blast"]
        DISP["/api/dispatcher\nQStash publisher\nEvery 5 min"]
        BLAST_R["/api/blast/*\nPer-org blast routes\nCalled by QStash"]
        BILL_C["/api/cron/billing-alerts\nDaily 10am UTC\nTrial/overdue emails"]
        CLEAN["/api/cron/cleanup-invites\nNightly"]
    end

    subgraph EXTERNAL["External Services"]
        SB["Supabase\nAuth + Postgres\n+ Storage"]
        STRIPE["Stripe\nLive mode\n$10/seat/month"]
        RESEND["Resend\nTransactional email\n+ Webhook"]
        TWILIO["Twilio\nSMS + IVR calls"]
    end

    IDX --> APP_L
    IDX --> PLAT_A
    IDX --> AA
    PORT --> APP_L
    AUTH --> PORTALS
    ACTIONS --> EXTERNAL
    CRON --> EXTERNAL
    DISP --> BLAST_R
```

---

## Migration History

| # | File | What it added |
|---|------|---------------|
| 0000 | thick_rhodey | Initial schema |
| 0005 | school_directory | CA public school directory (3,194 schools) |
| 0006 | user_uploads | Avatar + resume storage |
| 0007–0013 | various | Pay model, priority orders, sub assignments, notifications, timezone, completedAt |
| 0014 | billing_and_signup | Stripe fields, billing events, onboardingCompletedAt |
| 0015 | cron_enabled | Kill switch per org |
| 0016 | platform_settings | Single-row settings table |
| 0017 | branding | appName, logoUrl |
| 0018 | enable_rls | RLS on all 19 tables |
| 0019 | platform_org | subhub-platform org |
| 0020 | price_and_seats | seatCount, pricePerSeatCents, stripePriceId |
| 0021 | district_campus | districtName on orgs, district role |
| 0022 | campuses_table | campuses table, schools.campusId FK |
| 0023 | billing_contact | billingContactName, billingContactEmail |
| 0024 | email_bounced | emailBounced, emailBouncedAt on users |
| 0025 | times_configured | timesConfigured on schools |
