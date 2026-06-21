-- Migration 0021: district/campus hierarchy
-- Run in Supabase SQL editor

-- Add 'district' to the role enum
ALTER TYPE role ADD VALUE IF NOT EXISTS 'district';

-- District name on the org (the formal umbrella name, e.g. "Los Angeles Unified")
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS district_name text;

-- Physical campus each school sits on (schools sharing a campus name are co-located)
ALTER TABLE schools ADD COLUMN IF NOT EXISTS campus text;
