-- Factory portal, QC / Rework (UC7). The factory records QC (staff_qc_submit, factory-only) and sends fixed work back
-- (staff_rework_done, factory-only), per the team's QC flow (docs/db/staff-access.md). This migration only ADDS:
--   1. the factory reads the active QC checklist and the QC results of its own orders
--   2. the shop is told the QC result (passed / failed with the failed items) and when fixed work is sent back for QC,
--      in the same shop trigger as production (notify_shop_production); the customer is already told by notify_status
-- No existing policy is changed. Safe to re-run (create or replace, drop ... if exists).
begin;

drop policy if exists "factory reads qc items" on public.qc_items;
create policy "factory reads qc items" on public.qc_items for select to authenticated
  using (public.is_factory());
drop policy if exists "factory reads own qc results" on public.qc_results;
create policy "factory reads own qc results" on public.qc_results for select to authenticated
  using (order_id in (select public.my_factory_orders()));

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
  end if;
  if msg is not null then
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (new.order_id, 'shop', 0, new.order_code || ' · ' || msg);
  end if;
  return new;
end $$;
-- the trigger from the factory_production migration already fires on status changes; recreate it in case that one was not run
drop trigger if exists trg_notify_shop_production on public.orders;
create trigger trg_notify_shop_production after update of status, est_finish_date on public.orders
  for each row execute function public.notify_shop_production();

revoke all on function public.notify_shop_production() from public, anon, authenticated;

commit;
