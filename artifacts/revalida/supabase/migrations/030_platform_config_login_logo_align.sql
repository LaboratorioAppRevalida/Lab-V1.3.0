ALTER TABLE platform_config
  ADD COLUMN IF NOT EXISTS login_logo_align text NOT NULL DEFAULT 'center';
