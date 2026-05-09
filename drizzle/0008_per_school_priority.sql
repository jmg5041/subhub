ALTER TABLE sub_priority_orders ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
