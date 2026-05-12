ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'America/Los_Angeles';
