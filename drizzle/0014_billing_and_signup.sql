-- Migration 0014: billing columns, isPlatformAdmin, billing_events table
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)

-- Add billing + onboarding columns to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS paid_through date,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS plan_notes text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Add platform admin flag to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;

-- Billing event log (written by manual check form + Stripe webhooks)
CREATE TABLE IF NOT EXISTS billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  type text NOT NULL,
  amount_cents integer,
  note text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Backfill Southlands as active/comp so the billing gate doesn't block them
-- (replace the UUID below with the real org ID if needed — run: SELECT id FROM organizations WHERE slug = 'southlands')
UPDATE organizations
  SET subscription_status = 'active',
      payment_method      = 'comp',
      paid_through        = '2027-06-30',
      onboarding_completed_at = now()
  WHERE slug = 'southlands';

-- Mark Jesse as platform admin
UPDATE users
  SET is_platform_admin = true
  WHERE email = 'jessegentile@gmail.com';
