-- Migration 0025: track whether school day times have been explicitly confirmed
-- Schools created during onboarding get default 07:30-15:30 without admin confirmation.
-- This flag becomes true when an admin explicitly saves the school edit form.
-- Run in Supabase SQL editor.

ALTER TABLE schools ADD COLUMN IF NOT EXISTS times_configured boolean NOT NULL DEFAULT false;
