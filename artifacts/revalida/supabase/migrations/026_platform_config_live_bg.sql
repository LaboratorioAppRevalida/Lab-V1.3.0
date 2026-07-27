-- 026_platform_config_live_bg.sql
-- Adds Fundo Vivo (Live Background) columns: media type, video URL, animation type/speed
-- for both the app shell and the login page independently.
-- All additions use ADD COLUMN IF NOT EXISTS for full idempotency.

ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS bg_media_type                    text    NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS bg_video_url                     text,
  ADD COLUMN IF NOT EXISTS bg_image_animation               text    NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS bg_image_animation_speed         integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS login_bg_media_type              text    NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS login_bg_video_url               text,
  ADD COLUMN IF NOT EXISTS login_bg_image_animation         text    NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS login_bg_image_animation_speed   integer NOT NULL DEFAULT 60;
