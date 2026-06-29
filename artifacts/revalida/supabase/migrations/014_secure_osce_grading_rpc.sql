-- ============================================================
-- 014_secure_osce_grading_rpc.sql
-- Secure server-side grade calculation for multiplayer OSCE
-- Idempotente: pode ser executado múltiplas vezes com segurança
-- ============================================================
--
-- THREAT MODEL
-- ─────────────────────────────────────────────────────────────
-- Before this migration, the final OSCE grade for a multiplayer
-- session is calculated entirely on the client (Estacao.tsx /
-- TrainingContext.tsx) and then written directly to the sessions
-- table via supabase.from('sessions').upsert(...).
--
-- This means any authenticated user can:
--   1. Intercept the payload and replace `nota` with 10.0
--   2. Call supabase.from('sessions').upsert({ nota: 10 }) directly
--   3. Submit a doctored pepRespostas set that inflates their score
--
-- DEFENSE ARCHITECTURE
-- ─────────────────────────────────────────────────────────────
-- A SECURITY DEFINER RPC (fn_submit_and_calculate_osce_grade)
-- moves all grade arithmetic to the server:
--
--   1. Verify auth.uid() is a participant of the multiplayer session.
--   2. Verify the session is already in 'finished' state (encerrada).
--   3. Fetch the authoritative pep_blocks JSONB from the checklists
--      table — client cannot supply its own weights.
--   4. Cross-reference p_marked_items_json against those weights.
--   5. Compute total_score, max_score, nota (0–10) server-side.
--   6. INSERT the verified record into public.sessions.
--   7. Return { session_record_id, nota, nota_total, nota_maxima }
--      so the frontend can update local history state without a
--      second round-trip.
--
-- The frontend (TrainingContext.tsx / salvarEstacao) now calls
-- supabase.rpc('fn_submit_and_calculate_osce_grade', ...) for all
-- real multiplayer sessions. Mock / solo sessions continue to use
-- the existing client-side path (no multiplayer_session row).
--
-- Tables read (never written by caller): multiplayer_sessions,
--   checklists, profiles
-- Table written atomically: sessions (INSERT)
--
-- New RPC: public.fn_submit_and_calculate_osce_grade(UUID, JSONB)
-- ============================================================


-- ── Drop previous version (idempotent) ───────────────────────
DROP FUNCTION IF EXISTS public.fn_submit_and_calculate_osce_grade(UUID, JSONB);


-- ── Main RPC ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_submit_and_calculate_osce_grade(
  p_session_id        UUID,    -- multiplayer_sessions.id
  p_marked_items_json JSONB    -- [{id, resposta}] submitted by the client
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id       UUID    := auth.uid();
  v_mp              RECORD;
  v_medico_id       UUID;
  v_partner_id      UUID;
  v_pep_blocks      JSONB;
  v_checklist_nome  TEXT;
  v_grande_area     TEXT;
  v_block           JSONB;
  v_block_id        TEXT;
  v_score_adequado  NUMERIC;
  v_score_parcial   NUMERIC;
  v_resposta        TEXT;
  v_total_score     NUMERIC := 0;
  v_max_score       NUMERIC := 0;
  v_nota            NUMERIC;
  v_partner_nome    TEXT;
  v_record_id       UUID;
BEGIN
  -- ── 1. Authentication ────────────────────────────────────────
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated: must be logged in to submit grades';
  END IF;

  -- ── 2. Load multiplayer session ──────────────────────────────
  SELECT
    ms.id,
    ms.host_user_id,
    ms.guest_user_id,
    ms.host_role,
    ms.guest_role,
    ms.checklist_id,
    ms.status
  INTO v_mp
  FROM public.multiplayer_sessions ms
  WHERE ms.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found: multiplayer session % does not exist', p_session_id;
  END IF;

  -- ── 3. Authorization — caller must be a participant ──────────
  IF v_caller_id != v_mp.host_user_id AND v_caller_id != v_mp.guest_user_id THEN
    RAISE EXCEPTION
      'not_authorized: caller % is not a participant of session %',
      v_caller_id, p_session_id;
  END IF;

  -- ── 4. Determine which participant is the médico ─────────────
  --   Only the médico's record is saved; the paciente is the evaluator.
  IF v_mp.host_user_id = v_caller_id AND v_mp.host_role = 'medico' THEN
    v_medico_id  := v_mp.host_user_id;
    v_partner_id := v_mp.guest_user_id;
  ELSIF v_mp.guest_user_id = v_caller_id AND v_mp.guest_role = 'medico' THEN
    v_medico_id  := v_mp.guest_user_id;
    v_partner_id := v_mp.host_user_id;
  ELSE
    RAISE EXCEPTION
      'caller_is_not_medico: only the médico participant may submit a grade for session %',
      p_session_id;
  END IF;

  -- ── 5. Session must have ended before a grade can be submitted ─
  IF v_mp.status NOT IN ('finished', 'completed', 'graded') THEN
    RAISE EXCEPTION
      'session_not_ended: session % has status %, must be finished before grading',
      p_session_id, v_mp.status;
  END IF;

  -- ── 6. Fetch authoritative checklist data ────────────────────
  SELECT
    cl.title,
    cl.grande_area,
    cl.pep_blocks
  INTO v_checklist_nome, v_grande_area, v_pep_blocks
  FROM public.checklists cl
  WHERE cl.id = v_mp.checklist_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'checklist_not_found: checklist % referenced by session % does not exist',
      v_mp.checklist_id, p_session_id;
  END IF;

  IF v_pep_blocks IS NULL OR jsonb_array_length(v_pep_blocks) = 0 THEN
    RAISE EXCEPTION
      'checklist_has_no_blocks: checklist % has no pep_blocks — cannot compute grade',
      v_mp.checklist_id;
  END IF;

  -- ── 7. Cross-reference marks against authoritative weights ───
  --   For each block in the DB checklist, look up the client-supplied
  --   resposta and accumulate scores using the DB's own weights.
  --   Client-supplied scoreAdequado / scoreParcial values are ignored.
  FOR v_block IN
    SELECT value FROM jsonb_array_elements(v_pep_blocks) AS value
  LOOP
    v_block_id       := v_block->>'id';
    v_score_adequado := COALESCE((v_block->>'scoreAdequado')::NUMERIC, 0);
    v_score_parcial  := COALESCE((v_block->>'scoreParcial')::NUMERIC, 0);

    -- Accumulate maximum possible score for this block
    v_max_score := v_max_score + GREATEST(v_score_adequado, v_score_parcial, 0);

    -- Look up this block's resposta from the client-supplied marks
    SELECT elem->>'resposta'
    INTO   v_resposta
    FROM   jsonb_array_elements(p_marked_items_json) elem
    WHERE  elem->>'id' = v_block_id
    LIMIT  1;

    -- Add points only for adequado/parcial; inadequado or missing = 0
    IF v_resposta = 'adequado' THEN
      v_total_score := v_total_score + v_score_adequado;
    ELSIF v_resposta = 'parcial' THEN
      v_total_score := v_total_score + v_score_parcial;
    END IF;
  END LOOP;

  -- ── 8. Compute final nota on 0–10 scale ─────────────────────
  --   Mirrors the nota10() function in sessionService.ts:
  --   nota = ROUND((notaTotal / notaMaxima) * 10, 2)
  v_nota := CASE
    WHEN v_max_score > 0
    THEN ROUND((v_total_score / v_max_score) * 10, 2)
    ELSE 0
  END;

  -- ── 9. Resolve partner display name ─────────────────────────
  SELECT COALESCE(p.display_name, p.name, p.email, 'Parceiro')
  INTO   v_partner_nome
  FROM   public.profiles p
  WHERE  p.id = v_partner_id;

  IF NOT FOUND THEN
    v_partner_nome := 'Parceiro';
  END IF;

  -- ── 10. Atomically persist the verified grade ────────────────
  v_record_id := gen_random_uuid();

  INSERT INTO public.sessions (
    id,
    user_id,
    parceiro_nome,
    checklist_nome,
    area,
    papel,
    nota,
    ended_at
  ) VALUES (
    v_record_id,
    v_medico_id,
    v_partner_nome,
    v_checklist_nome,
    v_grande_area,
    'medico',
    v_nota,
    now()
  );

  -- ── 11. Return grade breakdown to caller ─────────────────────
  --   The frontend uses this to update local history state without
  --   needing a second round-trip to re-fetch from sessions.
  RETURN jsonb_build_object(
    'session_record_id', v_record_id,
    'nota',              v_nota,
    'nota_total',        ROUND(v_total_score::NUMERIC, 2),
    'nota_maxima',       ROUND(v_max_score::NUMERIC, 2)
  );
END;
$$;

-- Regular authenticated users may call this RPC; anon callers cannot.
GRANT EXECUTE ON FUNCTION public.fn_submit_and_calculate_osce_grade(UUID, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_submit_and_calculate_osce_grade(UUID, JSONB) FROM anon;


-- ── Audit comment ─────────────────────────────────────────────
COMMENT ON FUNCTION public.fn_submit_and_calculate_osce_grade(UUID, JSONB) IS
  'SECURITY DEFINER. Validates caller is a médico participant of the '
  'finished multiplayer session, fetches authoritative pep_blocks weights '
  'from the checklists table, computes total/max score and final nota '
  '(0–10) server-side, and atomically inserts the verified record into '
  'public.sessions. Returns {session_record_id, nota, nota_total, nota_maxima}. '
  'Added in migration 014. Replaces direct client-side sessions.upsert() '
  'for all real multiplayer OSCE sessions.';
