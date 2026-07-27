-- Migration 037: group_mentorship_participants table
create table if not exists public.group_mentorship_participants (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.group_mentorships(id) on delete cascade,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (group_id, student_id)
);

alter table public.group_mentorship_participants enable row level security;

-- Admins and the group's mentor can read participants
create policy "participants_select" on public.group_mentorship_participants
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and (is_admin = true or is_collaborator = true or is_mentor = true)
    )
  );

-- Only admins / collaborators can insert / delete participants
create policy "participants_insert" on public.group_mentorship_participants
  for insert with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and (is_admin = true or is_collaborator = true)
    )
  );

create policy "participants_delete" on public.group_mentorship_participants
  for delete using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and (is_admin = true or is_collaborator = true)
    )
  );
