-- Migration 032: subscriptions table
-- Stores the active subscription record for each user.
-- status: 'ativo' | 'pendente' | 'expirado' | 'cancelado'
-- payment_method: 'cartao' | 'pix' | 'boleto' | null

create table if not exists public.subscriptions (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  plan_name        text        not null,
  status           text        not null default 'ativo'
                               check (status in ('ativo','pendente','expirado','cancelado')),
  payment_method   text        check (payment_method in ('cartao','pix','boleto'))
                               default null,
  payment_last4    text        default null,
  expires_at       timestamptz default null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- One active subscription row per user (unique on user_id)
create unique index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);

-- Auto-update updated_at
create or replace function public.touch_subscriptions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_subscriptions_updated_at();

-- RLS
alter table public.subscriptions enable row level security;

-- Users can read their own subscription
create policy "subscriptions: user can read own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Admins can manage all subscriptions
create policy "subscriptions: admin can manage"
  on public.subscriptions for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );
