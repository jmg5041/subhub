-- Platform-wide settings table (single row)
CREATE TABLE platform_settings (
  id integer PRIMARY KEY DEFAULT 1,
  staff_alert_email text,
  updated_at timestamp DEFAULT now()
);

-- Insert the default row so it always exists
INSERT INTO platform_settings (id, staff_alert_email) VALUES (1, 'jessegentile@gmail.com');
