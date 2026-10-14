-- Factory portal, Notifications: the factory marks its own messages read (notifications.read_at).
-- A function rather than an update policy, so the factory can set read_at only, and only on its own unread messages.
-- p_ids null = every unread message of the factory. Adds one function; nothing existing is changed. Safe to re-run.
begin;

create or replace function public.factory_mark_notifications_read(p_ids bigint[] default null)
returns integer language plpgsql security definer set search_path = public as $$
declare fid bigint := my_factory_id(); n integer;
begin
  if fid is null then raise exception 'Not authorised'; end if;
  update notifications set read_at = now()
   where recipient_type = 'factory' and recipient_id = fid and read_at is null
     and (p_ids is null or notification_id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.factory_mark_notifications_read(bigint[]) from public, anon;
grant execute on function public.factory_mark_notifications_read(bigint[]) to authenticated;

commit;
