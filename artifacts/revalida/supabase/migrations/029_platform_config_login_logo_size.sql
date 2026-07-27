ALTER TABLE platform_config
  ADD COLUMN IF NOT EXISTS login_logo_size integer NOT NULL DEFAULT 64;
