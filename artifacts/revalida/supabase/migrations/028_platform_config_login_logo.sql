-- 028_platform_config_login_logo.sql
-- Adds login_logo_url column to store a custom brand image that replaces
-- the hardcoded "Revalida 2ª FASE" text header on the Login page.

ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS login_logo_url text;
