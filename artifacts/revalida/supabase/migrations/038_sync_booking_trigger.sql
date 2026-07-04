-- Migration 038: auto-sync current_bookings via trigger
-- Runs as SECURITY DEFINER to bypass RLS on group_mentorships updates

CREATE OR REPLACE FUNCTION public.sync_group_booking_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_group_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_group_id := OLD.group_id;
  ELSE
    target_group_id := NEW.group_id;
  END IF;

  UPDATE public.group_mentorships
  SET current_bookings = (
    SELECT COUNT(*)
    FROM public.group_mentorship_participants
    WHERE group_id = target_group_id
  )
  WHERE id = target_group_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_group_booking ON public.group_mentorship_participants;
CREATE TRIGGER trg_sync_group_booking
  AFTER INSERT OR DELETE ON public.group_mentorship_participants
  FOR EACH ROW EXECUTE FUNCTION public.sync_group_booking_count();
