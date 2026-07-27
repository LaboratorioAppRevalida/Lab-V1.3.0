-- 024_platform_config_image_controls.sql
-- Adds advanced background image control columns to the platform_config singleton.
-- All columns use safe ADD COLUMN IF NOT EXISTS to be idempotent.

ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS bg_image_opacity integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS bg_image_blur    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bg_image_scale   integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS bg_image_x       integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS bg_image_y       integer NOT NULL DEFAULT 50;
