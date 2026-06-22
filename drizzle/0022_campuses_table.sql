-- Migration 0022: campuses table
-- Campuses are physical locations (addresses). Schools within the same campus are co-located.
-- Run in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS campuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  address text,
  city text,
  state text DEFAULT 'CA',
  zip text,
  phone text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Block PostgREST access (same policy as all other tables — Drizzle bypasses RLS)
ALTER TABLE campuses ENABLE ROW LEVEL SECURITY;

-- Replace campus text label on schools with a proper FK to campuses
ALTER TABLE schools DROP COLUMN IF EXISTS campus;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS campus_id uuid REFERENCES campuses(id);
