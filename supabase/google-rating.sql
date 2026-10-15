-- One-row cache of Divino's Google rating, filled by the google-rating edge
-- function (supabase/functions/google-rating). Applied 2026-10-15.
create table if not exists public.google_rating (
  id smallint primary key default 1 check (id = 1),
  rating numeric(2,1),
  review_count integer,
  fetched_at timestamptz not null default now()
);
-- Only the edge function (service role) reads or writes it.
alter table public.google_rating enable row level security;
insert into public.google_rating (id, fetched_at) values (1, '2000-01-01') on conflict (id) do nothing;
