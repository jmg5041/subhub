-- Create the SubHub Platform org — permanent home for platform/IT staff.
-- Platform admins belong here instead of a school org, so they survive school deletions.
-- cron_enabled = false so no blast emails are ever sent from this org.
INSERT INTO organizations (
  id, name, slug,
  subscription_status, onboarding_completed_at, cron_enabled,
  auto_notify_subs, notify_by_sms, notify_by_email, notify_by_phone
)
VALUES (
  gen_random_uuid(),
  'SubHub Platform',
  'subhub-platform',
  'active',
  now(),
  false,
  false, false, false, false
);

-- Move jessegentile@gmail.com to the platform org and clear the school association.
UPDATE users
SET
  organization_id = (SELECT id FROM organizations WHERE slug = 'subhub-platform'),
  school_id = NULL
WHERE email = 'jessegentile@gmail.com';
