-- Granary TV V17: verified provider link test bench
-- Safe setup: creates a separate table and adds policies only if they do not already exist.
-- Leaves existing tables and policies untouched; does not modify library_items / programme_metadata.

create table if not exists public.programme_provider_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  normalized_title text not null,
  programme_title text not null,
  service text not null,
  candidate_url text,
  verification_status text not null default 'candidate'
    check (verification_status in ('candidate','page_verified','playback_confirmed','broken','not_available')),
  checked_at timestamptz,
  notes text,
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_title, service)
);

alter table public.programme_provider_links enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'programme_provider_links'
      and policyname = 'Users can view their own provider links'
  ) then
    create policy "Users can view their own provider links"
      on public.programme_provider_links
      for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'programme_provider_links'
      and policyname = 'Users can insert their own provider links'
  ) then
    create policy "Users can insert their own provider links"
      on public.programme_provider_links
      for insert to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'programme_provider_links'
      and policyname = 'Users can update their own provider links'
  ) then
    create policy "Users can update their own provider links"
      on public.programme_provider_links
      for update to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'programme_provider_links'
      and policyname = 'Users can delete their own provider links'
  ) then
    create policy "Users can delete their own provider links"
      on public.programme_provider_links
      for delete to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end
$$;

grant select, insert, update, delete on public.programme_provider_links to authenticated;
