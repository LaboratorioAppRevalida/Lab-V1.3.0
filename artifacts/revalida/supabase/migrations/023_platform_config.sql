-- 023_platform_config.sql
-- Singleton row (id = 1) holding platform-wide theme tokens.
-- All authenticated users can SELECT; only admins can write.

CREATE TABLE IF NOT EXISTS public.platform_config (
  id           integer      PRIMARY KEY DEFAULT 1,
  bg_color     text         NOT NULL DEFAULT '#03161a',
  glass_color  text         NOT NULL DEFAULT '#06181d',
  accent_color text         NOT NULL DEFAULT '#06b6d4',
  bg_image_url text,
  updated_at   timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT platform_config_singleton CHECK (id = 1)
);

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

-- Every authenticated user can read the global config.
CREATE POLICY "anyone_select" ON public.platform_config
  FOR SELECT TO authenticated
  USING (true);

-- Only platform admins may insert or update.
CREATE POLICY "admins_write" ON public.platform_config
  FOR ALL TO authenticated
  USING     (public.is_admin_check())
  WITH CHECK (public.is_admin_check());

-- Seed the default singleton row so SELECT always returns a row.
INSERT INTO public.platform_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
