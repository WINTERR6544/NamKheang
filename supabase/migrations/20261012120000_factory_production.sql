-- Factory portal, Production (UC6): start production with an estimated finish date, update it, mark it finished (-> 5 waiting_qc).
-- The factory calls factory_production (already factory-only: is_factory() and the order's factory). This migration only ADDS:
--   1. the factory reads the production updates of its own orders (timeline on the production page)
--   2. the shop is told when production starts, when the estimated finish date changes and when production is finished
--      (the customer is already told by notify_status / factory_production)
-- No existing policy or function is changed. Safe to re-run (create or replace, drop ... if exists).
begin;

drop policy if exists "factory reads own production updates" on public.production_updates;
create policy "factory reads own production updates" on public.production_updates for select to authenticated
  using (order_id in (select public.my_factory_orders()));

-- shop messages use recipient_id 0 = every shop user (same as remind_factories)
create or replace function public.notify_shop_production() returns trigger
language plpgsql security definer set search_path = public as $$
declare msg text;
begin
  if old.status = 3 and new.status = 4 then
    msg := 'Production started' || coalesce(' · Estimated finish ' || to_char(new.est_finish_date, 'DD/MM/YYYY'), '');
  elsif old.status = 4 and new.status = 5 then
    msg := 'Production finished · Waiting for QC';
  elsif old.status = 4 and new.status = 4 and new.est_finish_date is distinct from old.est_finish_date then
    msg := 'Estimated finish changed to ' || coalesce(to_char(new.est_finish_date, 'DD/MM/YYYY'), '-');
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
