-- Profile page for shop and factory users: a signed-in, active staff user can change their own name.
-- Role, factory, email and active flag stay with admin_update_user (Users & Roles page).
create or replace function public.staff_update_my_profile(p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare n text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN' using errcode = '28000'; end if;
  if char_length(n) not between 2 and 120 then raise exception 'INVALID_NAME' using errcode = '23514'; end if;
  update public.users set name = n where auth_id = auth.uid() and is_active;
  if not found then raise exception 'PROFILE_REQUIRED' using errcode = 'P0002'; end if;
end $$;

revoke all on function public.staff_update_my_profile(text) from public, anon;
grant execute on function public.staff_update_my_profile(text) to authenticated;
