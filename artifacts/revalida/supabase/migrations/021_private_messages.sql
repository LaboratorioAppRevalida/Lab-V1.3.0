-- ── private_messages ───────────────────────────────────────────────────────
-- Peer-to-peer chat messages. History is intentionally purged after 7 days
-- (enforced at query layer by filtering created_at > now() - interval '7 days').

create table if not exists public.private_messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content     text not null check (char_length(content) > 0 and char_length(content) <= 2000),
  created_at  timestamptz not null default now()
);

create index if not exists private_messages_participants_idx
  on public.private_messages (least(sender_id, receiver_id), greatest(sender_id, receiver_id), created_at desc);

create index if not exists private_messages_receiver_idx
  on public.private_messages (receiver_id, created_at desc);

-- ── RLS ────────────────────────────────────────────────────────────────────

alter table public.private_messages enable row level security;

-- Users can only read messages they sent or received
create policy "pm_select_own"
  on public.private_messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Users can only insert messages as themselves
create policy "pm_insert_own"
  on public.private_messages for insert
  with check (auth.uid() = sender_id);

-- No updates or deletes by users
