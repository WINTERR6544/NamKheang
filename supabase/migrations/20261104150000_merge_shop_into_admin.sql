-- One shop-side role: "shop" is merged into "admin". Shop staff become admins; roles are now admin | factory.
-- is_staff() keeps its name (every staff_* function uses it) and now means "active admin".
begin;

update public.users set role = 'admin' where role = 'shop';

alter table public.users drop constraint users_role_check;
alter table public.users add constraint users_role_check check (role in ('admin', 'factory'));

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from users where auth_id = auth.uid() and is_active and role = 'admin') $$;

create or replace function public.admin_add_user(p_name text, p_email text, p_role text, p_factory bigint)
returns bigint language plpgsql security definer set search_path = public, auth as $$
declare n text := nullif(trim(p_name), ''); e text := lower(nullif(trim(p_email), '')); id bigint;
begin
  if not is_admin() then raise exception 'Not authorised'; end if;
  if n is null or e is null then raise exception 'Please enter a name and an email'; end if;
  if p_role not in ('admin', 'factory') then raise exception 'Unknown role'; end if;
  if p_role = 'factory' and p_factory is null then raise exception 'A factory user needs a factory'; end if;
  if exists (select 1 from users where lower(email) = e) then raise exception 'This email already has an account'; end if;
  insert into users (auth_id, name, email, role, factory_id)
  values ((select u.id from auth.users u where lower(u.email) = e), n, e, p_role, case when p_role = 'factory' then p_factory end)
  returning user_id into id;
  return id;
end $$;

create or replace function public.admin_update_user(p_user bigint, p_name text, p_role text, p_factory bigint, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := my_user_id(); n text := nullif(trim(p_name), '');
begin
  if not is_admin() then raise exception 'Not authorised'; end if;
  if n is null then raise exception 'Please enter a name'; end if;
  if p_role not in ('admin', 'factory') then raise exception 'Unknown role'; end if;
  if p_role = 'factory' and p_factory is null then raise exception 'A factory user needs a factory'; end if;
  if p_user = me and (p_role <> 'admin' or not p_active) then raise exception 'You cannot demote or deactivate your own account'; end if;
  update users set name = n, role = p_role, factory_id = case when p_role = 'factory' then p_factory end, is_active = p_active
   where user_id = p_user;
  if not found then raise exception 'User not found'; end if;
end $$;

commit;
