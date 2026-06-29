-- =============================================================================
-- Migration 020 — Remove peer-rating system
--
-- The peer-review / star-rating feature has been deprecated and removed from
-- the frontend.  This migration closes the database endpoint so no client can
-- call it, and optionally documents the table removal.
--
-- Steps
-- ─────
-- 1. Drop the SECURITY DEFINER RPC that submitted ratings.
-- 2. Optionally drop the session_ratings table (commented out by default —
--    uncomment only if you want to destroy historical data permanently).
-- =============================================================================


-- ── 1. Drop the rating RPC ────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.fn_submit_peer_rating(UUID, UUID, INTEGER);


-- ── 2. (Optional) Drop the session_ratings table ─────────────────────────────
-- Uncomment the block below ONLY if you want to permanently delete all
-- historical peer-rating rows.  Leaving the table intact is the safe default:
-- it preserves data for audit purposes and does not affect the application
-- since no frontend code reads or writes it anymore.
--
-- DROP TABLE IF EXISTS public.session_ratings;


-- ── 3. Revoke any lingering grants (belt-and-suspenders) ─────────────────────
-- If the function no longer exists the REVOKE is a no-op; this is harmless.
REVOKE EXECUTE ON FUNCTION public.fn_submit_peer_rating(UUID, UUID, INTEGER) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_submit_peer_rating(UUID, UUID, INTEGER) FROM anon;
