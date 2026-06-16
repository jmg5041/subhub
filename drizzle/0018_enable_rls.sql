-- Enable Row-Level Security on all application tables.
--
-- WHY: Supabase exposes a REST API (PostgREST) on every table. Without RLS,
-- anyone with the public anon key can read/write/delete all data via that API.
--
-- HOW THIS IS SAFE: All server-side data access goes through either:
--   (a) Drizzle ORM via DATABASE_URL (postgres superuser — bypasses RLS)
--   (b) Supabase admin client with service role key (bypasses RLS)
-- No application code queries data tables via PostgREST, so no policies are needed.
-- Enabling RLS with no policies = deny all via PostgREST = locked down.

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "schools" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "substitutes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "absence_reasons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teacher_time_off" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sub_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assignment_time_off" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sub_school_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_school_notification_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sub_priority_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sub_notification_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sub_unavailability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "school_directory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_events" ENABLE ROW LEVEL SECURITY;
