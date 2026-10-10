-- QC and installation check flow (decided 2026-10-10)
--   * Manufacturing QC is checked by the factory only. The shop (admin) only views it.
--   * At installation the factory does an on-site QC, then confirms the install.
--   * The customer rechecks. A problem goes customer -> shop -> factory:
--     the customer reports it, the shop sees it and forwards it to the factory, then books a fix visit.

-- 1) on-site QC lives in qc_results as its own stage; a customer problem can be marked "forwarded"
alter table public.qc_results
  add column if not exists stage text not null default 'production' check (stage in ('production', 'onsite'));
alter table public.qc_results drop constraint if exists qc_results_order_id_round_no_item_id_key;
alter table public.qc_results
  add constraint qc_results_order_stage_round_item_key unique (order_id, stage, round_no, item_id);
alter table public.acceptance_checks
  add column if not exists forwarded_at timestamptz;

-- 2) who is the factory (admin and shop are not)
create or replace function public.is_factory() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from users where auth_id = auth.uid() and is_active and role = 'factory') $$;
create or replace function public.my_factory_id() returns bigint
language sql stable security definer set search_path = public as
$$ select factory_id from users where auth_id = auth.uid() and is_active and role = 'factory' $$;

-- 3) manufacturing actions are factory-only (the shop can no longer call them)
create or replace function public.staff_factory_response(p_order bigint, p_accept boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_factory() then raise exception 'Only the factory can reply to a production order'; end if;
  if not p_accept and coalesce(trim(p_reason), '') = '' then raise exception 'Please give the reason the factory declined'; end if;
  update factory_assignments
     set response = case when p_accept then 'accepted' else 'rejected' end,
         reject_reason = case when p_accept then null else p_reason end, responded_at = now()
   where order_id = p_order and response = 'pending' and factory_id = my_factory_id();
  if not found then raise exception 'There is no production order waiting for your reply'; end if;
end $$;

create or replace function public.staff_production(p_order bigint, p_stage text, p_est date default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  if not is_factory() then raise exception 'Only the factory can update production'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.factory_id is distinct from my_factory_id() then raise exception 'This order is not assigned to your factory'; end if;
  if p_stage = 'started' then
    if o.status <> 3 or not exists (select 1 from factory_assignments where order_id = p_order and response = 'accepted') then
      raise exception 'Production can start once the factory has accepted'; end if;
    if p_est is null then raise exception 'Please enter the estimated finish date'; end if;
    update orders set status = 4, started_at = now(), est_finish_date = p_est where order_id = p_order;
  elsif p_stage in ('in_progress', 'delayed') then
    if o.status <> 4 then raise exception 'The order is not in production'; end if;
    if p_est is not null then update orders set est_finish_date = p_est where order_id = p_order; end if;
    if p_stage = 'delayed' then
      insert into notifications (order_id, recipient_type, recipient_id, message)
      values (p_order, 'customer', o.customer_id, o.order_code || ' · Production delayed' ||
        coalesce(' New finish date ' || to_char(p_est, 'DD/MM/YYYY'), ''));
    end if;
  elsif p_stage = 'finished' then
    if o.status <> 4 then raise exception 'The order is not in production'; end if;
    update orders set status = 5, finished_at = now() where order_id = p_order;
  else
    raise exception 'Invalid stage';
  end if;
  insert into production_updates (order_id, stage, est_finish_date, note, updated_by)
  values (p_order, p_stage, p_est, p_note, my_user_id());
end $$;

-- QC: p_stage 'production' (order waiting for QC) or 'onsite' (install scheduled, before confirming the install)
drop function if exists public.staff_qc_submit(bigint, jsonb);
create or replace function public.staff_qc_submit(p_order bigint, p_results jsonb, p_stage text default 'production')
returns smallint language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; rnd int; n_items int; n_given int; all_ok boolean;
begin
  if not is_factory() then raise exception 'Only the factory can record QC'; end if;
  if p_stage not in ('production', 'onsite') then raise exception 'Invalid QC stage'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.factory_id is distinct from my_factory_id() then raise exception 'This order is not assigned to your factory'; end if;
  if p_stage = 'production' and o.status <> 5 then raise exception 'The order is not waiting for QC'; end if;
  if p_stage = 'onsite' and o.status <> 8 then raise exception 'On-site QC is recorded while the install is scheduled'; end if;
  select count(*) into n_items from qc_items where is_active;
  select count(distinct (r->>'item_id')) into n_given from jsonb_array_elements(p_results) r
   where (r->>'item_id')::bigint in (select item_id from qc_items where is_active);
  if n_given <> n_items then raise exception 'Please check every item'; end if;
  select coalesce(max(round_no), 0) + 1 into rnd from qc_results where order_id = p_order and stage = p_stage;
  insert into qc_results (order_id, factory_id, round_no, item_id, stage, passed, note, checked_by)
  select p_order, o.factory_id, rnd, (r->>'item_id')::bigint, p_stage, (r->>'passed')::boolean, r->>'note', my_user_id()
  from jsonb_array_elements(p_results) r
  where (r->>'item_id')::bigint in (select item_id from qc_items where is_active);
  select bool_and((r->>'passed')::boolean) into all_ok from jsonb_array_elements(p_results) r;
  if p_stage = 'onsite' then return o.status; end if; -- status stays 8; staff_confirm_installed checks the result
  if all_ok then
    update orders set status = 7 where order_id = p_order;
    return 7;
  end if;
  update orders set status = 6 where order_id = p_order;
  return 6;
end $$;

create or replace function public.staff_rework_done(p_order bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_factory() then raise exception 'Only the factory can send an order back for QC'; end if;
  update orders set status = 5
   where order_id = p_order and status = 6 and factory_id = my_factory_id();
  if not found then raise exception 'The order is not in the QC fix step'; end if;
end $$;

-- the factory confirms the install, only after a passing on-site QC recorded for the current visit
create or replace function public.staff_confirm_installed(p_order bigint)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; appt_at timestamptz; last_round int;
begin
  if not is_factory() then raise exception 'Only the factory can confirm the install'; end if;
  select * into o from orders where order_id = p_order and status = 8 for update;
  if not found then raise exception 'The order is not in the install-scheduled step'; end if;
  if o.factory_id is distinct from my_factory_id() then raise exception 'This order is not assigned to your factory'; end if;
  select max(created_at) into appt_at from appointments where order_id = p_order and status = 'scheduled';
  if appt_at is null then raise exception 'There is no install date yet'; end if;
  select max(round_no) into last_round from qc_results
   where order_id = p_order and stage = 'onsite' and checked_at > appt_at;
  if last_round is null then raise exception 'Record the on-site QC before confirming the install'; end if;
  if exists (select 1 from qc_results where order_id = p_order and stage = 'onsite' and round_no = last_round and not passed) then
    raise exception 'The on-site QC failed. Fix it and record a new on-site QC'; end if;
  update appointments set status = 'completed' where order_id = p_order and status = 'scheduled';
  update orders set status = 9, installed_at = now() where order_id = p_order;
end $$;

-- 4) customer problem: stays at "installed" and notifies the shop (no automatic reschedule)
create or replace function public.customer_submit_acceptance(p_order bigint, p_passed boolean, p_note text, p_method text, p_slip text)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; q quotations%rowtype; dep numeric;
begin
  select * into o from orders where order_id = p_order and customer_id = my_customer_id() and status = 9;
  if not found then raise exception 'This order has not reached the acceptance step yet'; end if;
  if not p_passed and coalesce(trim(p_note), '') = '' then raise exception 'Please describe the problem'; end if;
  insert into acceptance_checks (order_id, passed, note) values (p_order, p_passed, p_note);
  if p_passed then
    select * into q from quotations where order_id = p_order and status = 'accepted' order by created_at desc limit 1;
    select coalesce(sum(amount),0) into dep from payments where order_id = p_order and pay_type = 'deposit' and verified;
    if exists (select 1 from payments where order_id = p_order and pay_type = 'final') then
      raise exception 'Payment slip already sent, waiting for the shop to verify it'; end if;
    insert into payments (order_id, amount, pay_type, payment_method, slip_path, verified)
    values (p_order, q.total_price - dep, 'final', p_method, p_slip, false);
  else
    -- customer -> shop: the shop forwards it to the factory (staff_forward_problem) and books a fix visit
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (p_order, 'shop', 0, o.order_code || ' · Customer reported a problem: ' || p_note);
  end if;
end $$;

-- 5) shop -> factory
create or replace function public.staff_forward_problem(p_order bigint)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; a acceptance_checks%rowtype;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 9 then raise exception 'There is no customer problem to forward'; end if;
  select * into a from acceptance_checks where order_id = p_order order by checked_at desc limit 1;
  if not found or a.passed then raise exception 'The customer has not reported a problem'; end if;
  update acceptance_checks set forwarded_at = now() where check_id = a.check_id;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'factory', o.factory_id, o.order_code || ' · Customer reported a problem (via the shop): ' || coalesce(a.note, ''));
end $$;

-- the shop can book a fix visit straight from a customer problem (status 9 -> 8) and the factory is told
create or replace function public.staff_schedule_install(p_order bigint, p_datetime timestamptz, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status not in (7, 8, 9) then raise exception 'An install date can only be set after QC has passed'; end if;
  if o.status = 9 and not exists (
       select 1 from acceptance_checks a where a.order_id = p_order and not a.passed
          and a.checked_at = (select max(checked_at) from acceptance_checks where order_id = p_order)) then
    raise exception 'The customer has not reported a problem'; end if;
  update appointments set status = 'rescheduled', reschedule_count = reschedule_count + 1, reschedule_reason = p_reason
   where order_id = p_order and status = 'scheduled';
  insert into appointments (order_id, install_datetime, reschedule_count, created_by)
  values (p_order, p_datetime, coalesce((select max(reschedule_count) from appointments where order_id = p_order), 0), my_user_id());
  if o.status in (7, 9) then update orders set status = 8 where order_id = p_order; end if;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'customer', o.customer_id, o.order_code || ' · Install scheduled ' || to_char(p_datetime at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI'));
  if o.status = 9 then
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (p_order, 'factory', o.factory_id, o.order_code || ' · Fix visit scheduled ' || to_char(p_datetime at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI'));
  end if;
end $$;

-- new functions are for signed-in users only
revoke execute on function public.is_factory() from public, anon;
revoke execute on function public.my_factory_id() from public, anon;
revoke execute on function public.staff_forward_problem(bigint) from public, anon;
revoke execute on function public.staff_qc_submit(bigint, jsonb, text) from public, anon;
grant execute on function public.is_factory() to authenticated;
grant execute on function public.my_factory_id() to authenticated;
grant execute on function public.staff_forward_problem(bigint) to authenticated;
grant execute on function public.staff_qc_submit(bigint, jsonb, text) to authenticated;
