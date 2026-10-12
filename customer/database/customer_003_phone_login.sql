-- Private lookup and distributed rate limits. No browser role may call these.
begin;
create table if not exists public.customer_login_rate_limits(
  key_hash text primary key, window_started timestamptz not null default now(),
  attempts integer not null default 1
);
alter table public.customer_login_rate_limits enable row level security;
revoke all on public.customer_login_rate_limits from public,anon,authenticated;
grant all on public.customer_login_rate_limits to service_role;

create or replace function public.customer_phone_rate_limit_v2(p_key text,p_max integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  if p_key!~'^[0-9a-f]{64}$' or p_max not between 1 and 30 then return false; end if;
  insert into public.customer_login_rate_limits(key_hash) values(p_key)
  on conflict(key_hash) do update set
    attempts=case when customer_login_rate_limits.window_started<now()-interval '15 minutes' then 1 else customer_login_rate_limits.attempts+1 end,
    window_started=case when customer_login_rate_limits.window_started<now()-interval '15 minutes' then now() else customer_login_rate_limits.window_started end
  returning attempts into n;
  -- Expired limits contain hashes only. Bound table growth on every request.
  delete from public.customer_login_rate_limits where window_started<now()-interval '1 day';
  return n<=p_max;
end $$;
create or replace function public.customer_phone_credentials_v2(p_phone text)
returns text language sql stable security definer set search_path=public as $$
  select c.email from public.customers c join auth.users u on u.id=c.auth_id
  where public.customer_normalize_phone(c.phone)=p_phone and c.is_active
    and u.email_confirmed_at is not null limit 1
$$;
revoke all on function public.customer_phone_rate_limit_v2(text,integer),public.customer_phone_credentials_v2(text) from public,anon,authenticated;
grant execute on function public.customer_phone_rate_limit_v2(text,integer),public.customer_phone_credentials_v2(text),public.customer_normalize_phone(text) to service_role;
commit;
