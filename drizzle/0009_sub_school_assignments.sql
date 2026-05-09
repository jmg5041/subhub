CREATE TABLE IF NOT EXISTS sub_school_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  substitute_id uuid NOT NULL REFERENCES substitutes(id),
  school_id uuid NOT NULL REFERENCES schools(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id),
  UNIQUE(substitute_id, school_id)
);
