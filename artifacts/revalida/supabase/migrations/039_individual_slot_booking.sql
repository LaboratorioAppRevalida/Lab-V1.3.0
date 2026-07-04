-- 039_individual_slot_booking.sql
-- Adds student booking support to individual slots + fixes missing DELETE policies

-- ── 1. student_id column on mentorship_slots ─────────────────────────────────
ALTER TABLE mentorship_slots
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mentorship_slots_student_id ON mentorship_slots(student_id);

-- ── 2. DELETE policies (mentor deletes own, admin deletes any) ────────────────
CREATE POLICY "slots_delete_own"
  ON mentorship_slots FOR DELETE
  USING (
    mentor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "group_delete_own"
  ON group_mentorships FOR DELETE
  USING (
    mentor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ── 3. Allow student to book a slot (available → pending) ────────────────────
-- student sets student_id = their own uid and status = 'pending'
CREATE POLICY "slots_student_book"
  ON mentorship_slots FOR UPDATE
  USING (status = 'available')
  WITH CHECK (student_id = auth.uid() AND status = 'pending');

-- ── 4. Allow admin to confirm/reject bookings (update any slot) ───────────────
CREATE POLICY "slots_admin_update"
  ON mentorship_slots FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
