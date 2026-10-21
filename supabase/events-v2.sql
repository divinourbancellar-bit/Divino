-- Events v2: a wines line and an uploaded poster for each event (Sandra, 15 Oct 2026).
-- Run after schema.sql. The poster itself goes into the public "posters" storage
-- bucket through the event-poster edge function (it checks the admin password);
-- its public URL is kept in events.photo, as before.

alter table public.events add column if not exists wines text check (char_length(wines) <= 400);

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
revoke all on function public.admin_event_save(text, jsonb) from public;
grant execute on function public.admin_event_save(text, jsonb) to anon, authenticated;

-- Public bucket: anyone can view a poster, only the edge function (service role) writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posters', 'posters', true, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
