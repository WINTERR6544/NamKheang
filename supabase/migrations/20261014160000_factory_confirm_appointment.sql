-- The factory answers a booked install date: confirm it as booked (this migration), or ask to move it
-- (factory_request_reschedule, migration install_reschedule_requests).
-- Adds a nullable column and one factory function; nothing existing is changed. Existing reads (named columns or *) and
-- staff_schedule_install keep working; a newly booked date starts unconfirmed, so the factory confirms each new date.
-- Safe to re-run.
begin;

alter table public.appointments add column if not exists factory_confirmed_at timestamptz;

create or replace function public.factory_confirm_appointment(p_order bigint)
returns void language plpgsql security definer set search_path = public as $$
declare fid bigint := my_factory_id(); o orders%rowtype; appt appointments%rowtype;
begin
  if fid is null then raise exception 'Not authorised'; end if;
  select * into o from orders where order_id = p_order;
  if not found or o.factory_id is distinct from fid then raise exception 'This order is not assigned to your factory'; end if;
  if o.status <> 8 then raise exception 'Only a booked install can be confirmed'; end if;
  select * into appt from appointments where order_id = p_order and status = 'scheduled' order by created_at desc limit 1 for update;
  if not found then raise exception 'There is no install date yet'; end if;
  if appt.factory_confirmed_at is not null then raise exception 'This install date is already confirmed'; end if;
  if exists (select 1 from install_reschedule_requests where order_id = p_order and status = 'pending') then
    raise exception 'A request to move this install is waiting for the shop'; end if;
  update appointments set factory_confirmed_at = now() where appointment_id = appt.appointment_id;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'shop', 0, o.order_code || ' · The factory confirmed the install date ' ||
    to_char(appt.install_datetime at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI'));
end $$;

revoke all on function public.factory_confirm_appointment(bigint) from public, anon;
grant execute on function public.factory_confirm_appointment(bigint) to authenticated;

commit;
