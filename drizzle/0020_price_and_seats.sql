-- Migration 0020: configurable pricing + seat count
-- Run in Supabase SQL editor

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS seat_count integer;

ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS price_per_seat_cents integer NOT NULL DEFAULT 800;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- Seed current price ID so the column isn't NULL on first read
UPDATE platform_settings SET stripe_price_id = 'price_1Ti1dlB7AVFO3ftiA0nOLuxN' WHERE stripe_price_id IS NULL;
