-- Divino → Brevo: every newsletter sign-up is added to a Brevo list automatically,
-- and "Unsubscribe" on the admin page also blocks the address in Brevo.
-- Run AFTER schema.sql, in Supabase → SQL Editor.
--
-- BEFORE running, do two things in the Divino Brevo account:
--   1. Contacts → Lists → create a list, e.g. "Letters from Sicily", and note its ID number.
--   2. SMTP & API → API Keys → Generate a new API key, and copy it.
-- Then, in Supabase SQL Editor, run this ONE line yourself (paste your key between the quotes),
-- so the key is stored encrypted in Supabase Vault and never in the website code:
--   select vault.create_secret('xkeysib-PASTE-YOUR-KEY', 'brevo_api_key');
-- Finally change 0 below to the list ID from step 1, and run this whole file.

create extension if not exists pg_net with schema extensions;

-- Which Brevo list each website sign-up form goes to. "*" is the fallback.
create table if not exists private.brevo_lists (
  list text primary key,
  brevo_list_id int not null
);
revoke all on private.brevo_lists from public, anon, authenticated;

insert into private.brevo_lists (list, brevo_list_id) values ('*', 3)   -- ← put your Brevo list ID here
on conflict (list) do update set brevo_list_id = excluded.brevo_list_id;
-- Optional: send "The Countryside opening news" sign-ups to a different list:
-- insert into private.brevo_lists values ('The Countryside opening news', 7);

create or replace function private.brevo_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  api_key text;
  list_id int;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'brevo_api_key' limit 1;
  if api_key is null then return new; end if;   -- not set up yet: keep the sign-up, skip Brevo
  select brevo_list_id into list_id from private.brevo_lists
    where list in (new.list, '*') order by (list = '*') limit 1;
  if coalesce(list_id, 0) = 0 then return new; end if;

  -- Create or update the contact (updateEnabled), add it to the list, and
  -- mirror the admin page's Unsubscribe as a Brevo block.
  perform net.http_post(
    url := 'https://api.brevo.com/v3/contacts',
    headers := jsonb_build_object('api-key', api_key, 'Content-Type', 'application/json', 'accept', 'application/json'),
    body := jsonb_build_object(
      'email', new.email,
      'listIds', jsonb_build_array(list_id),
      'updateEnabled', true,
      'emailBlacklisted', new.unsubscribed
    )
  );
  return new;
end $$;
revoke all on function private.brevo_sync() from public, anon, authenticated;

drop trigger if exists subscribers_to_brevo on public.subscribers;
create trigger subscribers_to_brevo
  after insert or update of unsubscribed on public.subscribers
  for each row execute function private.brevo_sync();

-- Send everyone who signed up before this was set up (safe to run again).
update public.subscribers set unsubscribed = unsubscribed;

-- Check it worked: the most recent calls to Brevo and their answers
-- (201 = added, 204 = updated; 400/401 = check the list ID or API key).
-- select id, status_code, content from net._http_response order by id desc limit 10;
