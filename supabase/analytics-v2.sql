-- Divino analytics v2 (13 Oct 2026)
-- Run once in the Divino Supabase project: SQL Editor -> paste -> Run.
-- Safe to run twice. Adds:
--   * two new click kinds: 'email' and 'instagram'
--   * a "channel" column that remembers which tracking link a visitor used
--     (utm_source / utm_campaign, e.g. "instagram / bio")
--   * richer numbers for the admin Analytics tab (daily actions by type,
--     campaigns, pages that bring enquiries, busiest hours and weekdays)
-- Until this has run, the website keeps working: it simply leaves out the
-- channel, and the two new click kinds are not stored.

alter table public.hits add column if not exists channel text check (char_length(channel) <= 80);

alter table public.hits drop constraint if exists hits_kind_check;
alter table public.hits add constraint hits_kind_check
  check (kind in ('view','book_open','book_calendar','whatsapp','call','signup','directions','email','instagram'));

create index if not exists hits_channel_idx on public.hits (channel) where channel is not null;

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
        select date_trunc('day', created_at)::date as day,
               count(*) filter (where kind = 'view') as views,
               count(distinct visitor) filter (where kind = 'view') as visitors,
               count(*) filter (where kind in ('book_open','book_calendar','whatsapp','call','email')) as actions,
               count(*) filter (where kind = 'book_open') as book,
               count(*) filter (where kind = 'book_calendar') as calendar,
               count(*) filter (where kind = 'whatsapp') as whatsapp,
               count(*) filter (where kind = 'call') as call,
               count(*) filter (where kind = 'email') as email,
               count(*) filter (where kind = 'directions') as directions,
               count(*) filter (where kind = 'instagram') as instagram,
               count(*) filter (where kind = 'signup') as signup
        from hits where created_at >= since group by 1) d),
    'top_pages', (select coalesce(json_agg(t), '[]') from (
        select path, count(*) as views from hits where kind = 'view' and created_at >= since
        group by path order by views desc limit 12) t),
    'pages', (select coalesce(json_agg(t), '[]') from (
        select path,
               count(*) filter (where kind = 'view') as views,
               count(*) filter (where kind in ('book_open','whatsapp','call','email')) as enquiries
        from hits where created_at >= since
        group by path order by enquiries desc, views desc limit 12) t),
    'referrers', (select coalesce(json_agg(t), '[]') from (
        select coalesce(nullif(referrer, ''), 'Direct / unknown') as referrer, count(*) as views from hits
        where kind = 'view' and created_at >= since group by 1 order by views desc limit 10) t),
    'campaigns', (select coalesce(json_agg(t), '[]') from (
        select channel,
               count(*) filter (where kind = 'view') as views,
               count(*) filter (where kind in ('book_open','whatsapp','call','email')) as enquiries
        from hits where channel is not null and created_at >= since
        group by channel order by views desc, enquiries desc limit 12) t),
    'devices', (select coalesce(json_object_agg(coalesce(device, 'unknown'), n), '{}') from (
        select device, count(*) as n from hits where kind = 'view' and created_at >= since group by device) t),
    'languages', (select coalesce(json_object_agg(coalesce(lang, 'unknown'), n), '{}') from (
        select lang, count(*) as n from hits where kind = 'view' and created_at >= since group by lang) t),
    'actions', (select coalesce(json_object_agg(kind, n), '{}') from (
        select kind, count(*) as n from hits where kind <> 'view' and created_at >= since group by kind) t),
    'hours', (select coalesce(json_agg(t order by t.h), '[]') from (
        select extract(hour from created_at at time zone 'Europe/Rome')::int as h, count(*) as n
        from hits where kind = 'view' and created_at >= since group by 1) t),
    'weekdays', (select coalesce(json_agg(t order by t.d), '[]') from (
        select extract(dow from created_at at time zone 'Europe/Rome')::int as d, count(*) as n
        from hits where kind = 'view' and created_at >= since group by 1) t),
    'subscribers_total', (select count(*) from subscribers where not unsubscribed),
    'subscribers_new', (select count(*) from subscribers where created_at >= since),
    'upcoming_events', (select count(*) from events where date >= current_date)
  );
end $$;

revoke all on function public.admin_stats_pw(text, int) from public;
grant execute on function public.admin_stats_pw(text, int) to anon, authenticated;
