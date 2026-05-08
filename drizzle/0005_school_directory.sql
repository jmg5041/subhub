-- Add county to schools (already applied manually if you ran the previous migration)
ALTER TABLE schools ADD COLUMN IF NOT EXISTS county TEXT;

-- Add county to substitutes
ALTER TABLE substitutes ADD COLUMN IF NOT EXISTS county TEXT;

-- Create public school directory table
CREATE TABLE IF NOT EXISTS school_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cd_code TEXT,
  district_name TEXT,
  school_name TEXT NOT NULL,
  county TEXT NOT NULL,
  city TEXT,
  address TEXT,
  state TEXT DEFAULT 'CA',
  zip TEXT,
  phone TEXT,
  school_type TEXT,
  grade_range TEXT,
  claimed_by_org_id UUID REFERENCES organizations(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index on county for fast county-filter queries
CREATE INDEX IF NOT EXISTS idx_school_directory_county ON school_directory(county);
CREATE INDEX IF NOT EXISTS idx_school_directory_claimed ON school_directory(claimed_by_org_id);
