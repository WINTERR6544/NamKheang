-- Admin > บัญชีและสิทธิ์: one page for every sign-in account (customer, admin, factory).
--   admin_accounts()        every account with its role, factory, status and open orders
--   admin_set_account(...)  change role (customer <-> admin <-> factory) and activate / deactivate
-- Deactivated = cannot sign in at all (auth ban); orders and history stay.
-- A users row is never deleted (orders, payments and QC refer to it): going back to customer unlinks it,
-- and promoting again relinks the same row by email. Safe to re-run.
begin;

create or replace function public.admin_accounts()
returns table (auth_id uuid, email text, name text, phone text, role text, factory_id bigint, factory_name text,
               is_active boolean, orders int, open_orders int, created_at timestamptz, last_sign_in timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not is_admin() then raise exception 'Not authorised'; end if;
  return query
    select u.id, u.email::text,
           coalesce(nullif(x.name, ''), nullif(c.name, ''), nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1))::text,
           c.phone::text,
           coalesce(x.role, 'customer'),
           x.factory_id, f.name::text,
           (u.banned_until is null or u.banned_until < now()) and coalesce(x.is_active, c.is_active, true),
           coalesce(o.n, 0)::int, coalesce(o.open, 0)::int,
           u.created_at, u.last_sign_in_at
      from auth.users u
      left join users x on x.auth_id = u.id
      left join factories f on f.factory_id = x.factory_id
      left join customers c on c.auth_id = u.id
      left join lateral (select count(*) n, count(*) filter (where r.status not in (10, 99)) open
                           from orders r where r.customer_id = c.customer_id) o on true
     where u.email is not null
     order by u.created_at desc;
end $$;

create or replace function public.admin_set_account(p_auth uuid, p_role text, p_factory bigint, p_active boolean)
returns void language plpgsql security definer set search_path = public, auth as $$
declare a auth.users; x users; c customers; cur text;
begin
  if not is_admin() then raise exception 'Not authorised'; end if;
  if p_role not in ('customer', 'admin', 'factory') then raise exception 'Unknown role'; end if;
  if p_role = 'factory' and not exists (select 1 from factories where factory_id = p_factory and is_active) then
    raise exception 'A factory user needs a factory'; end if;
  if p_auth = auth.uid() and (p_role <> 'admin' or not p_active) then
    raise exception 'You cannot demote or deactivate your own account'; end if;

  select * into a from auth.users where id = p_auth;
  if not found then raise exception 'User not found'; end if;
  select * into x from users where auth_id = p_auth;
  if not found then select * into x from users where auth_id is null and lower(email) = lower(a.email) limit 1; end if;
  select * into c from customers where auth_id = p_auth;
  cur := case when x.auth_id = p_auth then x.role else 'customer' end;

  if p_role in ('admin', 'factory') then
    if cur = 'customer' and exists (select 1 from orders where customer_id = c.customer_id and status not in (10, 99)) then
      raise exception 'This customer still has orders in progress'; end if;
    if x.user_id is not null then
      update users set auth_id = p_auth, email = a.email, role = p_role, is_active = p_active,
             factory_id = case when p_role = 'factory' then p_factory end
       where user_id = x.user_id;
    else
      insert into users (auth_id, name, email, role, factory_id, is_active)
      values (p_auth, coalesce(nullif(c.name, ''), nullif(a.raw_user_meta_data ->> 'name', ''), split_part(a.email, '@', 1)),
              a.email, p_role, case when p_role = 'factory' then p_factory end, p_active);
    end if;
  else
    if x.auth_id = p_auth then update users set auth_id = null, is_active = false where user_id = x.user_id; end if;
    if c.customer_id is not null then update customers set is_active = p_active where customer_id = c.customer_id; end if;
  end if;

  update auth.users set banned_until = case when p_active then null else 'infinity'::timestamptz end where id = p_auth;
end $$;

revoke all on function public.admin_accounts() from public, anon;
revoke all on function public.admin_set_account(uuid, text, bigint, boolean) from public, anon;
grant execute on function public.admin_accounts() to authenticated;
grant execute on function public.admin_set_account(uuid, text, bigint, boolean) to authenticated;

commit;
