-- Add cron_enabled kill switch to organizations
-- Default true so all existing schools keep receiving notifications
ALTER TABLE organizations ADD COLUMN cron_enabled boolean NOT NULL DEFAULT true;
