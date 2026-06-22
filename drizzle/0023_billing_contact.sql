-- Migration 0023: billing contact on organizations
-- Run in Supabase SQL editor

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_contact_name text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_contact_email text;
