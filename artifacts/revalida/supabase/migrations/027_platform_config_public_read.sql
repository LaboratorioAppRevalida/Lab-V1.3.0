-- 027_platform_config_public_read.sql
-- The login page renders before any user is authenticated, so the anon role
-- must be able to SELECT platform_config to load the custom background.
-- This migration drops the authenticated-only select policy and replaces it
-- with one that covers both anon (unauthenticated) and authenticated roles.

DROP POLICY IF EXISTS "anyone_select" ON public.platform_config;

CREATE POLICY "anyone_select" ON public.platform_config
  FOR SELECT TO anon, authenticated
  USING (true);
