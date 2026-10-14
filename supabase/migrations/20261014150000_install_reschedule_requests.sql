-- Factory asks the shop to move an install date (UC8 alternative flow: the factory asks, the shop books the new date).
-- A request is kept apart from appointments: the booked appointment stays 'scheduled', so staff_confirm_installed and
-- staff_schedule_install work as before. The shop approves by booking the new date with staff_schedule_install;
-- a new appointment closes the order's pending request.
-- Adds a table, its read policies, one factory function and one trigger; nothing existing is changed. Safe to re-run.
begin;

create table if not exists public.install_reschedule_requests (
  request_id        bigint generated always as identity primary key,
  order_id          bigint not null references public.orders (order_id) on delete cascade,
  appointment_id    bigint references public.appointments (appointment_id) on delete set null,
  proposed_datetime timestamptz not null,
  reason            text not null check (length(trim(reason)) > 0),
  status            text not null default 'pending' check (status in ('pending', 'resolved')),
  requested_by      bigint references public.users (user_id),
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);
create unique index if not exists one_pending_reschedule_request on public.install_reschedule_requests (order_id) where status = 'pending';
alter table public.install_reschedule_requests enable row level security;

drop policy if exists "factory reads own reschedule requests" on public.install_reschedule_requests;
create policy "factory reads own reschedule requests" on public.install_reschedule_requests for select to authenticated
  using (order_id in (select public.my_factory_orders()));
drop policy if exists "staff reads reschedule requests" on public.install_reschedule_requests;
create policy "staff reads reschedule requests" on public.install_reschedule_requests for select to authenticated
  using (public.is_staff());

-- the factory asks for a new date with a reason; the shop is told with both
create or replace function public.factory_request_reschedule(p_order bigint, p_datetime timestamptz, p_reason text)
returns bigint language plpgsql security definer set search_path = public as $$
declare fid bigint := my_factory_id(); o orders%rowtype; appt appointments%rowtype; r text := nullif(trim(p_reason), ''); id bigint;
begin
  if fid is null then raise exception 'Not authorised'; end if;
  if r is null then raise exception 'Please give the reason for moving the install date'; end if;
  if length(r) > 500 then raise exception 'The reason is too long (500 characters at most)'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found or o.factory_id is distinct from fid then raise exception 'This order is not assigned to your factory'; end if;
  if o.status <> 8 then raise exception 'Only a booked install can be moved'; end if;
  select * into appt from appointments where order_id = p_order and status = 'scheduled' order by created_at desc limit 1;
  if not found then raise exception 'There is no install date yet'; end if;
  if p_datetime is null or p_datetime <= now() then raise exception 'Please choose a new date in the future'; end if;
  if p_datetime = appt.install_datetime then raise exception 'The new date is the same as the current one'; end if;
  if exists (select 1 from install_reschedule_requests where order_id = p_order and status = 'pending') then
    raise exception 'A request to move this install is already waiting for the shop'; end if;
  insert into install_reschedule_requests (order_id, appointment_id, proposed_datetime, reason, requested_by)
  values (p_order, appt.appointment_id, p_datetime, r, my_user_id()) returning request_id into id;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'shop', 0, o.order_code || ' · The factory asks to move the install from ' ||
    to_char(appt.install_datetime at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI') || ' to ' ||
    to_char(p_datetime at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI') || ' · Reason: ' || r);
  return id;
end $$;

-- the shop booking a new date (staff_schedule_install) answers the order's pending request
create or replace function public.resolve_reschedule_requests() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update install_reschedule_requests set status = 'resolved', resolved_at = now()
   where order_id = new.order_id and status = 'pending';
  return new;
end $$;
drop trigger if exists trg_resolve_reschedule_requests on public.appointments;
create trigger trg_resolve_reschedule_requests after insert on public.appointments
  for each row execute function public.resolve_reschedule_requests();

revoke all on function public.factory_request_reschedule(bigint, timestamptz, text) from public, anon;
grant execute on function public.factory_request_reschedule(bigint, timestamptz, text) to authenticated;
revoke all on function public.resolve_reschedule_requests() from public, anon, authenticated;

commit;
