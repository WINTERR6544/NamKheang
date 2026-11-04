-- Admin > Users & Roles > Add user: the account picker now lists every sign-in account that is not staff yet,
-- including customer accounts (every sign-up makes a customer row, so the old list was always empty).
-- Return type changes, so drop and recreate. Safe to re-run.
begin;

drop function if exists public.admin_unlinked_accounts();

create function public.admin_unlinked_accounts()
returns table (email text, name text, phone text, is_customer boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not is_admin() then raise exception 'Not authorised'; end if;
  return query
    select u.email::text,
           coalesce(nullif(c.name, ''), nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1))::text,
           c.phone::text,
           c.customer_id is not null
      from auth.users u
      left join customers c on c.auth_id = u.id
     where u.email is not null
       and not exists (select 1 from users x where lower(x.email) = lower(u.email) or x.auth_id = u.id)
     order by (c.customer_id is not null), u.email;
end $$;

revoke all on function public.admin_unlinked_accounts() from public, anon;
grant execute on function public.admin_unlinked_accounts() to authenticated;

commit;
