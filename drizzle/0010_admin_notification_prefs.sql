ALTER TABLE users ADD COLUMN IF NOT EXISTS alert_on_teacher_submit boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alert_on_unfilled boolean NOT NULL DEFAULT true;
