CREATE TABLE IF NOT EXISTS user_school_notification_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  alert_on_teacher_submit boolean NOT NULL DEFAULT true,
  alert_on_unfilled boolean NOT NULL DEFAULT true,
  UNIQUE(user_id, school_id)
);

ALTER TABLE users DROP COLUMN IF EXISTS alert_on_teacher_submit;
ALTER TABLE users DROP COLUMN IF EXISTS alert_on_unfilled;
