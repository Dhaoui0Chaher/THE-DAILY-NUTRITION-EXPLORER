-- Optional NutriAtlas AI request quota (per authenticated user).
-- Only the server-side service_role can claim a quota slot; never expose that credential to web clients.
create table if not exists public.nutriatlas_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (now() at time zone 'utc')::date,
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 100000),
  primary key (user_id, usage_date)
);
alter table public.nutriatlas_ai_usage enable row level security;
revoke all on public.nutriatlas_ai_usage from anon, authenticated;
grant select, insert, update on public.nutriatlas_ai_usage to service_role;
create or replace function public.nutriatlas_claim_ai_request(p_user_id uuid, p_daily_limit integer default 8)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare used_count integer;
begin
  if p_user_id is null or p_daily_limit < 1 or p_daily_limit > 50 then return false; end if;
  insert into public.nutriatlas_ai_usage (user_id, usage_date, attempts)
  values (p_user_id, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, usage_date)
  do update set attempts = public.nutriatlas_ai_usage.attempts + 1
  where public.nutriatlas_ai_usage.attempts < p_daily_limit
  returning attempts into used_count;
  return used_count is not null;
end;
$$;
revoke all on function public.nutriatlas_claim_ai_request(uuid, integer) from public, anon, authenticated;
grant execute on function public.nutriatlas_claim_ai_request(uuid, integer) to service_role;
