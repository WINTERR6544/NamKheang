-- Factory portal, Installation (UC8 schedule, UC9 confirm install, UC10 fix after a failed customer acceptance).
-- The shop books the install date (staff_schedule_install, which already tells the factory and the customer); the factory
-- records an on-site QC (staff_qc_submit 'onsite') and confirms the install (staff_confirm_installed), both factory-only.
-- This migration only ADDS:
--   1. the factory reads the install appointments of its own orders
--   2. the factory reads a customer's failed acceptance once the shop has forwarded it (staff_forward_problem)
--   3. the shop is told when the factory confirms the install (8 -> 9), in the shop trigger notify_shop_production
-- No existing policy is changed. Safe to re-run (create or replace, drop ... if exists).
begin;

drop policy if exists "factory reads own appointments" on public.appointments;
create policy "factory reads own appointments" on public.appointments for select to authenticated
  using (order_id in (select public.my_factory_orders()));
drop policy if exists "factory reads forwarded problems" on public.acceptance_checks;
create policy "factory reads forwarded problems" on public.acceptance_checks for select to authenticated
  using (forwarded_at is not null and order_id in (select public.my_factory_orders()));

-- shop messages use recipient_id 0 = every shop user (same as remind_factories)
create or replace function public.notify_shop_production() returns trigger
language plpgsql security definer set search_path = public as $$
declare msg text; rnd int; failed text;
begin
  if old.status = 3 and new.status = 4 then
    msg := 'Production started' || coalesce(' · Estimated finish ' || to_char(new.est_finish_date, 'DD/MM/YYYY'), '');
  elsif old.status = 4 and new.status = 5 then
    msg := 'Production finished · Waiting for QC';
  elsif old.status = 4 and new.status = 4 and new.est_finish_date is distinct from old.est_finish_date then
    msg := 'Estimated finish changed to ' || coalesce(to_char(new.est_finish_date, 'DD/MM/YYYY'), '-');
  elsif old.status = 5 and new.status in (6, 7) then
    -- staff_qc_submit inserts the round's results before it changes the status
    select max(round_no) into rnd from qc_results where order_id = new.order_id and stage = 'production';
    if new.status = 7 then
      msg := 'QC passed (round ' || rnd || ')';
    else
      select string_agg(i.item_name || coalesce(': ' || nullif(r.note, ''), ''), '; ' order by i.item_id) into failed
        from qc_results r join qc_items i on i.item_id = r.item_id
       where r.order_id = new.order_id and r.stage = 'production' and r.round_no = rnd and not r.passed;
      msg := 'QC failed (round ' || rnd || ') · To fix: ' || coalesce(failed, '-');
    end if;
  elsif old.status = 6 and new.status = 5 then
    msg := 'Fixed after QC · Waiting for QC again';
  elsif old.status = 8 and new.status = 9 then
    msg := 'Install confirmed by the factory · Waiting for the customer to accept';
  end if;
  if msg is not null then
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (new.order_id, 'shop', 0, new.order_code || ' · ' || msg);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_shop_production on public.orders;
create trigger trg_notify_shop_production after update of status, est_finish_date on public.orders
  for each row execute function public.notify_shop_production();

revoke all on function public.notify_shop_production() from public, anon, authenticated;

commit;
