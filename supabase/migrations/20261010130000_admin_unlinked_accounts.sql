-- Admin > Users & Roles > Add user: pick the person from a dropdown of sign-in accounts that are not a user or customer yet.
-- Adds one read-only function. Safe to re-run.
begin;

create or replace function public.admin_unlinked_accounts()
returns table (email text, name text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not is_admin() then raise exception 'Not authorised'; end if;
  return query
    select u.email::text, coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1))
      from auth.users u
     where u.email is not null
       and not exists (select 1 from users x where lower(x.email) = lower(u.email))
       and not exists (select 1 from customers c where c.auth_id = u.id)
     order by u.email;
end $$;

revoke all on function public.admin_unlinked_accounts() from public, anon;
grant execute on function public.admin_unlinked_accounts() to authenticated;

commit;
