-- ============================================================
-- Pressed Pages — authenticated Supabase setup
-- Run this once in the SQL Editor of your Supabase project.
-- Enable Email/password under Authentication -> Providers.
-- Also disable "Allow public access" under Realtime -> Settings.
-- ============================================================

-- ---------- tables ----------
create table if not exists public.pp_journals (
  id         uuid primary key,
  title      text not null default 'Pressed Pages',
  created_at timestamptz not null default now()
);

alter table public.pp_journals
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create table if not exists public.pp_pages (
  id         uuid primary key,
  journal_id uuid not null references public.pp_journals(id) on delete cascade,
  page_index double precision not null,
  kind       text not null default 'canvas',
  content    jsonb not null default '[]'::jsonb,
  rev        integer not null default 0,
  updated_at timestamptz not null default now()
);

create unique index if not exists pp_pages_journal_page_idx
  on public.pp_pages (journal_id, page_index);
create index if not exists pp_pages_journal_id_idx
  on public.pp_pages (journal_id);

create table if not exists public.pp_members (
  journal_id uuid not null references public.pp_journals(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (journal_id, user_id)
);

-- This definer function prevents recursive membership-table RLS checks.
create or replace function public.pp_is_member(p_journal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.pp_members m
    where m.journal_id = p_journal_id
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.pp_is_member(uuid) from public, anon;
grant execute on function public.pp_is_member(uuid) to authenticated;

-- The first authenticated user initializes the singleton from the oldest
-- existing journal (preserving prior shared content), or seeds a new one.
create table if not exists public.pp_global_journal (
  singleton boolean primary key default true check (singleton),
  journal_id uuid references public.pp_journals(id) on delete set null
);

alter table public.pp_global_journal enable row level security;
revoke all on public.pp_global_journal from public, anon, authenticated;

create or replace function public.pp_open_global_journal(
  p_journal_id uuid,
  p_title text,
  p_created_at timestamptz,
  p_pages jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  global_journal_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to open the shared journal.';
  end if;

  insert into public.pp_global_journal (singleton)
  values (true)
  on conflict (singleton) do nothing;

  select g.journal_id into global_journal_id
  from public.pp_global_journal g
  where g.singleton = true
  for update;

  if global_journal_id is null then
    select j.id into global_journal_id
    from public.pp_journals j
    order by j.created_at, j.id
    limit 1;

    if global_journal_id is null then
      insert into public.pp_journals (id, title, created_at, created_by)
      values (p_journal_id, coalesce(nullif(trim(p_title), ''), 'Pressed Pages'),
              coalesce(p_created_at, now()), auth.uid());
      global_journal_id := p_journal_id;
    end if;

    if not exists (
      select 1 from public.pp_pages p where p.journal_id = global_journal_id
    ) then
      insert into public.pp_pages (id, journal_id, page_index, kind, content, rev)
      select page.id, global_journal_id, page.page_index, page.kind,
             coalesce(page.content, '[]'::jsonb), coalesce(page.rev, 0)
      from jsonb_to_recordset(coalesce(p_pages, '[]'::jsonb)) as page(
        id uuid,
        page_index double precision,
        kind text,
        content jsonb,
        rev integer
      );
    end if;

    update public.pp_global_journal
    set journal_id = global_journal_id
    where singleton = true;
  end if;

  insert into public.pp_members (journal_id, user_id)
  values (global_journal_id, auth.uid())
  on conflict (journal_id, user_id) do nothing;

  return global_journal_id;
end;
$$;

drop function if exists public.pp_create_journal(uuid, text, timestamptz);
drop function if exists public.pp_invite_member(uuid, text);
revoke all on function public.pp_open_global_journal(uuid, text, timestamptz, jsonb) from public, anon;
grant execute on function public.pp_open_global_journal(uuid, text, timestamptz, jsonb) to authenticated;

-- ---------- row level security ----------
alter table public.pp_journals enable row level security;
alter table public.pp_pages enable row level security;
alter table public.pp_members enable row level security;

grant select, update on public.pp_journals to authenticated;
grant select, insert, update on public.pp_pages to authenticated;
grant select on public.pp_members to authenticated;

drop policy if exists "pp_journals_read" on public.pp_journals;
drop policy if exists "pp_journals_write" on public.pp_journals;
drop policy if exists "pp_journals_insert" on public.pp_journals;
drop policy if exists "pp_journals_delete" on public.pp_journals;
create policy "pp_journals_read" on public.pp_journals
  for select to authenticated using (public.pp_is_member(id));
create policy "pp_journals_write" on public.pp_journals
  for update to authenticated using (public.pp_is_member(id))
  with check (public.pp_is_member(id));
create policy "pp_journals_delete" on public.pp_journals
  for delete to authenticated using (public.pp_is_member(id));

drop policy if exists "pp_pages_read" on public.pp_pages;
drop policy if exists "pp_pages_write" on public.pp_pages;
drop policy if exists "pp_pages_insert" on public.pp_pages;
drop policy if exists "pp_pages_delete" on public.pp_pages;
create policy "pp_pages_read" on public.pp_pages
  for select to authenticated using (public.pp_is_member(journal_id));
create policy "pp_pages_write" on public.pp_pages
  for update to authenticated using (public.pp_is_member(journal_id))
  with check (public.pp_is_member(journal_id));
create policy "pp_pages_insert" on public.pp_pages
  for insert to authenticated with check (public.pp_is_member(journal_id));
create policy "pp_pages_delete" on public.pp_pages
  for delete to authenticated using (public.pp_is_member(journal_id));

drop policy if exists "pp_members_read" on public.pp_members;
create policy "pp_members_read" on public.pp_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.pp_is_member(journal_id));

-- ---------- private photo storage ----------
insert into storage.buckets (id, name, public)
values ('pp-photos', 'pp-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "pp_photos_read" on storage.objects;
drop policy if exists "pp_photos_write" on storage.objects;
drop policy if exists "pp_photos_delete" on storage.objects;
create policy "pp_photos_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pp-photos'
    and exists (
      select 1 from public.pp_members m
      where m.user_id = (select auth.uid())
        and m.journal_id::text = (storage.foldername(name))[1]
    )
  );
create policy "pp_photos_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pp-photos'
    and exists (
      select 1 from public.pp_members m
      where m.user_id = (select auth.uid())
        and m.journal_id::text = (storage.foldername(name))[1]
    )
  );
create policy "pp_photos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pp-photos'
    and exists (
      select 1 from public.pp_members m
      where m.user_id = (select auth.uid())
        and m.journal_id::text = (storage.foldername(name))[1]
    )
  );

-- ---------- private realtime channels ----------
-- App channels are named "pp-" followed by the journal UUID.
drop policy if exists "pp_realtime_member_read" on realtime.messages;
drop policy if exists "pp_realtime_member_write" on realtime.messages;
create policy "pp_realtime_member_read" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and exists (
      select 1 from public.pp_members m
      where m.user_id = (select auth.uid())
        and m.journal_id::text = substring((select realtime.topic()) from 4)
    )
  );
create policy "pp_realtime_member_write" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and exists (
      select 1 from public.pp_members m
      where m.user_id = (select auth.uid())
        and m.journal_id::text = substring((select realtime.topic()) from 4)
    )
  );

-- The first call to pp_open_global_journal adopts the oldest existing journal
-- (by created_at, then id) if one exists. Other legacy journals remain stored
-- but are no longer selectable from the application.
