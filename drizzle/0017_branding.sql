ALTER TABLE platform_settings
  ADD COLUMN app_name text DEFAULT 'SubHub',
  ADD COLUMN logo_url text;

UPDATE platform_settings SET app_name = 'SubHub' WHERE id = 1;
