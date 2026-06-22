-- Migration 0024: track email delivery failures on users
-- Run in Supabase SQL editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_bounced boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_bounced_at timestamp;
