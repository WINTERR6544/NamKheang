-- Admin > Users & Roles: only a user with role 'admin' can add or edit accounts (shop staff stay read-only).
-- Adds functions only: no existing policy or function is changed. Safe to re-run (create or replace).
begin;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from users where auth_id = auth.uid() and is_active and role = 'admin') $$;

-- edit a user's name, role, factory and active flag.
-- Guards: admin only; an admin cannot demote or deactivate themselves; a factory user needs a factory, others must not have one.
create or replace function public.admin_update_user(p_user bigint, p_name text, p_role text, p_factory bigint, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := my_user_id(); n text := nullif(trim(p_name), '');
begin
  if not is_admin() then raise exception 'Not authorised'; end if;
  if n is null then raise exception 'Please enter a name'; end if;
  if p_role not in ('admin', 'shop', 'factory') then raise exception 'Unknown role'; end if;
  if p_role = 'factory' and p_factory is null then raise exception 'A factory user needs a factory'; end if;
  if p_user = me and (p_role <> 'admin' or not p_active) then raise exception 'You cannot demote or deactivate your own account'; end if;
  update users set name = n, role = p_role, factory_id = case when p_role = 'factory' then p_factory end, is_active = p_active
   where user_id = p_user;
  if not found then raise exception 'User not found'; end if;
end $$;

-- add a user. The person signs in with a Supabase Auth account using the same email:
-- linked now if that account already exists, otherwise linked automatically when it is created (trigger below).
create or replace function public.admin_add_user(p_name text, p_email text, p_role text, p_factory bigint)
returns bigint language plpgsql security definer set search_path = public, auth as $$
declare n text := nullif(trim(p_name), ''); e text := lower(nullif(trim(p_email), '')); id bigint;
begin
  if not is_admin() then raise exception 'Not authorised'; end if;
  if n is null or e is null then raise exception 'Please enter a name and an email'; end if;
  if p_role not in ('admin', 'shop', 'factory') then raise exception 'Unknown role'; end if;
  if p_role = 'factory' and p_factory is null then raise exception 'A factory user needs a factory'; end if;
  if exists (select 1 from users where lower(email) = e) then raise exception 'This email already has an account'; end if;
  insert into users (auth_id, name, email, role, factory_id)
  values ((select u.id from auth.users u where lower(u.email) = e), n, e, p_role, case when p_role = 'factory' then p_factory end)
  returning user_id into id;
  return id;
end $$;

-- link a new Auth account to a user row added earlier with the same email
create or replace function public.link_user_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update users set auth_id = new.id where lower(email) = lower(new.email) and auth_id is null;
  return new;
end $$;
drop trigger if exists link_user_on_signup on auth.users;
create trigger link_user_on_signup after insert on auth.users for each row execute function public.link_user_on_signup();

revoke all on function public.is_admin(), public.admin_update_user(bigint, text, text, bigint, boolean),
  public.admin_add_user(text, text, text, bigint) from public, anon;
grant execute on function public.is_admin(), public.admin_update_user(bigint, text, text, bigint, boolean),
  public.admin_add_user(text, text, text, bigint) to authenticated;

commit;
