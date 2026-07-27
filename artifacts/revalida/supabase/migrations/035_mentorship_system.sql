-- 035_mentorship_system.sql
-- Mentorship Marketplace: mentor profiles, individual slots, group sessions, reviews

-- Phase 1a: Extend profiles table with mentor fields
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_mentor         boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mentor_bio        text,
  ADD COLUMN IF NOT EXISTS mentor_specialty  text,
  ADD COLUMN IF NOT EXISTS mentor_avatar_url text;

-- Phase 1b: Individual mentorship slots
CREATE TABLE IF NOT EXISTS mentorship_slots (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_time  timestamptz NOT NULL,
  end_time    timestamptz NOT NULL,
  status      text        NOT NULL DEFAULT 'available',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentorship_slots_mentor_id ON mentorship_slots(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_slots_status    ON mentorship_slots(status);

-- Phase 1c: Group mentorship sessions
CREATE TABLE IF NOT EXISTS group_mentorships (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title             text        NOT NULL,
  description       text,
  start_time        timestamptz NOT NULL,
  end_time          timestamptz NOT NULL,
  max_capacity      integer     NOT NULL DEFAULT 10,
  current_bookings  integer     NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_mentorships_mentor_id ON group_mentorships(mentor_id);

-- Phase 1d: Mentor reviews (1 per student per mentor)
CREATE TABLE IF NOT EXISTS mentor_reviews (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating      integer     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mentor_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_mentor_reviews_mentor_id ON mentor_reviews(mentor_id);

-- RLS: keep tables accessible to authenticated users
ALTER TABLE mentorship_slots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_mentorships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_reviews     ENABLE ROW LEVEL SECURITY;

-- Slots: anyone authenticated can read; only the mentor can insert/update their own
CREATE POLICY "slots_select"  ON mentorship_slots  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "slots_insert"  ON mentorship_slots  FOR INSERT WITH CHECK (mentor_id = auth.uid());
CREATE POLICY "slots_update"  ON mentorship_slots  FOR UPDATE USING (mentor_id = auth.uid());

-- Group sessions: anyone authenticated can read; only mentor can modify
CREATE POLICY "group_select"  ON group_mentorships FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "group_insert"  ON group_mentorships FOR INSERT WITH CHECK (mentor_id = auth.uid());
CREATE POLICY "group_update"  ON group_mentorships FOR UPDATE USING (mentor_id = auth.uid());

-- Reviews: anyone authenticated can read; students insert/update their own reviews
CREATE POLICY "reviews_select" ON mentor_reviews   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "reviews_insert" ON mentor_reviews   FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "reviews_update" ON mentor_reviews   FOR UPDATE USING (student_id = auth.uid());
