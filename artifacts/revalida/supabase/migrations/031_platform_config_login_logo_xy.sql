ALTER TABLE platform_config
  ADD COLUMN IF NOT EXISTS login_logo_x integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS login_logo_y integer NOT NULL DEFAULT 0;
