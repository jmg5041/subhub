-- Sub pay model: how the org bills sub hours (block vs exact hourly)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sub_pay_model text DEFAULT 'block';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS half_day_hours numeric(3,1) DEFAULT 4.0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS full_day_hours numeric(3,1) DEFAULT 8.0;

-- Sub assignment: track pay basis and any general-duties hours
ALTER TABLE sub_assignments ADD COLUMN IF NOT EXISTS pay_basis text DEFAULT 'exact';
ALTER TABLE sub_assignments ADD COLUMN IF NOT EXISTS general_duties_hours numeric(4,2);
ALTER TABLE sub_assignments ADD COLUMN IF NOT EXISTS general_duties_notes text;
