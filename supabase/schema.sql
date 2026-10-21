-- Divino Urban Cellar — complete database setup for a fresh Supabase project.
-- Run once (Supabase dashboard → SQL Editor, or via the Supabase connector).
-- Then put the project URL and publishable key into site.js, events.html and admin.html.
--
-- Visitors can only ADD rows (newsletter sign-ups, page stats). Reading and editing
-- goes through the admin_* functions, which check the shared admin password.
-- Change the password with:
--   update private.admin_password set hash = extensions.crypt('NEW PASSWORD', extensions.gen_salt('bf'));

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables

create table public.subscribers (
  id bigint generated always as identity primary key,
  email text not null check (char_length(email) between 5 and 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  list text not null default 'Letters from Sicily' check (char_length(list) <= 80),
  lang text not null default 'en' check (lang in ('en','it')),
  page text check (char_length(page) <= 200),
  unsubscribed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (email, list)
);
alter table public.subscribers enable row level security;
create policy "anyone can subscribe" on public.subscribers for insert to anon, authenticated
  with check (unsubscribed = false);

create table public.events (
  id bigint generated always as identity primary key,
  date date not null,
  time text check (char_length(time) <= 20),
  name text not null check (char_length(name) <= 160),
  description text check (char_length(description) <= 400),
  wines text check (char_length(wines) <= 400),
  price text check (char_length(price) <= 20),
  booking text check (char_length(booking) <= 500),
  photo text check (char_length(photo) <= 300),
  published boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
create policy "public reads published events" on public.events for select to anon, authenticated using (published);

-- Site stats: no IP, nothing personal. "visitor" is the random dv_vid cookie,
-- only sent after the visitor accepts cookies.
create table public.hits (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('view','book_open','book_calendar','whatsapp','call','signup','directions','email','instagram')),
  path text not null check (char_length(path) <= 200),
  detail text check (char_length(detail) <= 120),
  referrer text check (char_length(referrer) <= 120),
  device text check (device in ('mobile','desktop')),
  lang text check (lang in ('en','it')),
  visitor text check (visitor ~ '^[a-z0-9]{8,32}$'),
  channel text check (char_length(channel) <= 80),
  created_at timestamptz not null default now()
);
create index hits_created_idx on public.hits (created_at desc);
create index hits_visitor_idx on public.hits (visitor) where visitor is not null;
alter table public.hits enable row level security;
create policy "anyone can record a hit" on public.hits for insert to anon, authenticated with check (true);

-- ---------------------------------------------------------------- admin password

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.admin_password (id int primary key default 1 check (id = 1), hash text not null);
revoke all on private.admin_password from public, anon, authenticated;
insert into private.admin_password (hash) values (extensions.crypt('1234', extensions.gen_salt('bf')));

create or replace function private.check_pw(pw text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if pw is null or not exists (select 1 from private.admin_password where hash = extensions.crypt(pw, hash)) then
    raise exception 'wrong password' using errcode = '28P01';
  end if;
end $$;
revoke all on function private.check_pw(text) from public, anon, authenticated;

-- After this file, run supabase/analytics-v2.sql: it replaces admin_stats_pw with the richer v2 version,
-- and supabase/events-v2.sql for the event posters bucket.

-- ---------------------------------------------------------------- admin functions

create or replace function public.admin_login(pw text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin perform private.check_pw(pw); return true; end $$;

create or replace function public.admin_stats_pw(pw text, days int default 30) returns json
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(days, 366)));
begin
  perform private.check_pw(pw);
  return json_build_object(
    'views', (select count(*) from hits where kind = 'view' and created_at >= since),
    'visitors', (select count(distinct visitor) from hits where kind = 'view' and created_at >= since and visitor is not null),
    'returning', (select count(*) from (
        select visitor from hits where kind = 'view' and visitor is not null and created_at >= since
        group by visitor having count(distinct date_trunc('day', created_at)) > 1) r),
    'per_day', (select coalesce(json_agg(d order by d.day), '[]') from (
        select date_trunc('day', created_at)::date as day, count(*) filter (where kind = 'view') as views,
               count(distinct visitor) filter (where kind = 'view') as visitors,
               count(*) filter (where kind in ('book_open','book_calendar','whatsapp','call')) as actions
        from hits where created_at >= since group by 1) d),
    'top_pages', (select coalesce(json_agg(t), '[]') from (
        select path, count(*) as views from hits where kind = 'view' and created_at >= since
        group by path order by views desc limit 12) t),
    'referrers', (select coalesce(json_agg(t), '[]') from (
        select coalesce(nullif(referrer, ''), 'Direct / unknown') as referrer, count(*) as views from hits
        where kind = 'view' and created_at >= since group by 1 order by views desc limit 10) t),
    'devices', (select coalesce(json_object_agg(coalesce(device, 'unknown'), n), '{}') from (
        select device, count(*) as n from hits where kind = 'view' and created_at >= since group by device) t),
    'languages', (select coalesce(json_object_agg(coalesce(lang, 'unknown'), n), '{}') from (
        select lang, count(*) as n from hits where kind = 'view' and created_at >= since group by lang) t),
    'actions', (select coalesce(json_object_agg(kind, n), '{}') from (
        select kind, count(*) as n from hits where kind <> 'view' and created_at >= since group by kind) t),
    'subscribers_total', (select count(*) from subscribers where not unsubscribed),
    'subscribers_new', (select count(*) from subscribers where created_at >= since),
    'upcoming_events', (select count(*) from events where date >= current_date)
  );
end $$;

create or replace function public.admin_subscribers(pw text) returns setof public.subscribers
language plpgsql stable security definer set search_path = public as $$
begin perform private.check_pw(pw); return query select * from subscribers order by created_at desc limit 5000; end $$;

create or replace function public.admin_subscriber_set(pw text, sub_id bigint, is_unsubscribed boolean) returns void
language plpgsql security definer set search_path = public as $$
begin perform private.check_pw(pw); update subscribers set unsubscribed = is_unsubscribed where id = sub_id; end $$;

create or replace function public.admin_subscriber_delete(pw text, sub_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin perform private.check_pw(pw); delete from subscribers where id = sub_id; end $$;

create or replace function public.admin_events(pw text) returns setof public.events
language plpgsql stable security definer set search_path = public as $$
begin perform private.check_pw(pw); return query select * from events order by date desc; end $$;

create or replace function public.admin_event_save(pw text, ev jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.check_pw(pw);
  if coalesce(ev->>'booking', '') <> '' and ev->>'booking' !~ '^https://' then raise exception 'booking link must start with https://'; end if;
  if ev ? 'id' and nullif(ev->>'id', '') is not null then
    update events set date = (ev->>'date')::date, time = nullif(ev->>'time',''), name = ev->>'name',
      description = nullif(ev->>'description',''), wines = nullif(ev->>'wines',''), price = nullif(ev->>'price',''),
      booking = nullif(ev->>'booking',''), photo = nullif(ev->>'photo',''), published = coalesce((ev->>'published')::boolean, true)
    where id = (ev->>'id')::bigint;
  else
    insert into events (date, time, name, description, wines, price, booking, photo, published)
    values ((ev->>'date')::date, nullif(ev->>'time',''), ev->>'name', nullif(ev->>'description',''), nullif(ev->>'wines',''),
      nullif(ev->>'price',''), nullif(ev->>'booking',''), nullif(ev->>'photo',''), coalesce((ev->>'published')::boolean, true));
  end if;
end $$;

create or replace function public.admin_event_delete(pw text, ev_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin perform private.check_pw(pw); delete from events where id = ev_id; end $$;

do $$ declare f text; begin
  foreach f in array array['admin_login(text)','admin_stats_pw(text,int)','admin_subscribers(text)','admin_subscriber_set(text,bigint,boolean)',
    'admin_subscriber_delete(text,bigint)','admin_events(text)','admin_event_save(text,jsonb)','admin_event_delete(text,bigint)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;
