-- 025_platform_config_login.sql
-- Adds independent login-screen styling columns to the platform_config singleton.
-- All additions use ADD COLUMN IF NOT EXISTS for full idempotency.

ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS login_bg_color         text    NOT NULL DEFAULT '#03161a',
  ADD COLUMN IF NOT EXISTS login_glass_color       text    NOT NULL DEFAULT '#06181d',
  ADD COLUMN IF NOT EXISTS login_accent_color      text    NOT NULL DEFAULT '#06b6d4',
  ADD COLUMN IF NOT EXISTS login_bg_image_url      text,
  ADD COLUMN IF NOT EXISTS login_bg_image_opacity  integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS login_bg_image_blur     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS login_bg_image_scale    integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS login_bg_image_x        integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS login_bg_image_y        integer NOT NULL DEFAULT 50;
