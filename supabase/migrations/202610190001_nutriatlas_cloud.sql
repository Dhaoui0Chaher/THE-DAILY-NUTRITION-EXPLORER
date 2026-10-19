-- NutriAtlas Cloud / project ksddpaamsvmwfipymtyq
-- Run in Supabase SQL Editor for this project. Does not expose records to anonymous visitors.
create table if not exists public.nutriatlas_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint nutriatlas_payload_size check (octet_length(data::text) <= 524288)
);
alter table public.nutriatlas_user_data enable row level security;
revoke all on public.nutriatlas_user_data from anon;
grant select, insert, update, delete on public.nutriatlas_user_data to authenticated;
drop policy if exists "nutriatlas_owner_select" on public.nutriatlas_user_data;
drop policy if exists "nutriatlas_owner_insert" on public.nutriatlas_user_data;
drop policy if exists "nutriatlas_owner_update" on public.nutriatlas_user_data;
drop policy if exists "nutriatlas_owner_delete" on public.nutriatlas_user_data;
create policy "nutriatlas_owner_select" on public.nutriatlas_user_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "nutriatlas_owner_insert" on public.nutriatlas_user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "nutriatlas_owner_update" on public.nutriatlas_user_data
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "nutriatlas_owner_delete" on public.nutriatlas_user_data
  for delete to authenticated using ((select auth.uid()) = user_id);
create or replace function public.nutriatlas_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.nutriatlas_touch_updated_at() from public, anon;
drop trigger if exists nutriatlas_user_data_touch on public.nutriatlas_user_data;
create trigger nutriatlas_user_data_touch
  before insert or update on public.nutriatlas_user_data
  for each row execute function public.nutriatlas_touch_updated_at();
