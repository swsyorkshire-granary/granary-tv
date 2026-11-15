-- Granary TV V16: per-user programme metadata cache
-- Run once in Supabase Dashboard > SQL Editor. Does not alter or delete library_items.
create table if not exists public.programme_metadata (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  normalized_title text not null,
  search_title text not null,
  source text not null default 'TVmaze',
  source_id bigint,
  matched_title text,
  match_status text not null default 'needs_review' check (match_status in ('matched','needs_review','not_found')),
  image_url text,
  summary text,
  source_url text,
  genres text[] not null default '{}',
  premiered date,
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_title)
);
alter table public.programme_metadata enable row level security;
drop policy if exists "Users can view their own programme metadata" on public.programme_metadata;
create policy "Users can view their own programme metadata" on public.programme_metadata for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert their own programme metadata" on public.programme_metadata;
create policy "Users can insert their own programme metadata" on public.programme_metadata for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their own programme metadata" on public.programme_metadata;
create policy "Users can update their own programme metadata" on public.programme_metadata for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their own programme metadata" on public.programme_metadata;
create policy "Users can delete their own programme metadata" on public.programme_metadata for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.programme_metadata to authenticated;
