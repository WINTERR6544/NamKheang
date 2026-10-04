-- Translate database-side Thai text to English (reference data, sample rows, error and notification messages).

-- reference data
update public.order_statuses set description = 'Customer sent the order' where status_code = 0;
update public.order_statuses set description = 'Quoted, waiting for the customer' where status_code = 1;
update public.order_statuses set description = 'Deposit paid' where status_code = 2;
update public.order_statuses set description = 'Sent to factory, waiting for reply' where status_code = 3;
update public.order_statuses set description = 'In production' where status_code = 4;
update public.order_statuses set description = 'Built, waiting for QC' where status_code = 5;
update public.order_statuses set description = 'QC failed, sent back to fix' where status_code = 6;
update public.order_statuses set description = 'QC passed' where status_code = 7;
update public.order_statuses set description = 'Install scheduled' where status_code = 8;
update public.order_statuses set description = 'Factory confirmed install done' where status_code = 9;
update public.order_statuses set description = 'Accepted and fully paid' where status_code = 10;
update public.order_statuses set description = 'Cancelled' where status_code = 99;
update public.business_rules set description = 'Deposit as a % of the total price' where rule_key = 'deposit_percent';
update public.business_rules set description = 'Quotation validity' where rule_key = 'quote_valid_days';
update public.business_rules set description = 'Factory must reply within' where rule_key = 'factory_reply_days';
update public.business_rules set description = 'Failed QC rounds allowed before considering another factory' where rule_key = 'max_qc_rounds';
update public.business_rules set description = 'Notice required to reschedule' where rule_key = 'reschedule_notice_days';
update public.business_rules set description = 'Pay the balance within this time after acceptance' where rule_key = 'final_payment_days';
update public.business_rules set unit = 'days' where unit = 'วัน';
update public.business_rules set unit = 'rounds' where unit = 'รอบ';

-- sample rows (only rows still carrying the original sample values)
update public.machine_models set machine_type = 'Tube ice machine', capacity = '500 kg/day', description = 'Compact. Good for shops and restaurants' where code = 'IF-T05';
update public.machine_models set machine_type = 'Tube ice machine', capacity = '1 ton/day', description = 'Mid-size. Runs all day' where code = 'IF-T10';
update public.machine_models set machine_type = 'Tube ice machine', capacity = '2 tons/day', description = 'High output for small ice plants' where code = 'IF-T20';
update public.machine_models set machine_type = 'Flake ice machine', capacity = '1 ton/day', description = 'Fine flake ice for seafood and fresh markets' where code = 'IF-F10';
update public.machine_models set machine_type = 'Flake ice machine', capacity = '2 tons/day', description = 'Fine flakes, high output' where code = 'IF-F20';
update public.machine_models set machine_type = 'Block ice machine', capacity = '500 kg/day', description = 'Clear block ice for beverage shops' where code = 'IF-C05';
update public.factories set name = 'Thai Ice Factory' where name = 'โรงงานน้ำแข็งไทย';
update public.factories set contact_name = 'Mr. Somchai' where contact_name = 'คุณสมชาย';
update public.qc_items set item_name = 'Cooling system and ice production' where item_name = 'ตรวจระบบทำความเย็นและการผลิตน้ำแข็ง';
update public.qc_items set item_name = 'Electrical system and safety' where item_name = 'ตรวจระบบไฟฟ้าและความปลอดภัย';
update public.qc_items set item_name = 'Appearance and assembly' where item_name = 'ตรวจรูปลักษณ์และการประกอบ';

-- functions (create or replace keeps existing grants)
create or replace function public.customer_accept_quote(p_order bigint, p_method text, p_slip text)
returns void language plpgsql security definer set search_path = public as $$
declare q quotations%rowtype;
begin
  perform 1 from orders where order_id = p_order and customer_id = my_customer_id() and status = 1;
  if not found then raise exception 'This order is not waiting for quote confirmation'; end if;
  select * into q from quotations where order_id = p_order and status = 'sent' order by created_at desc limit 1;
  if not found then raise exception 'Quotation not found'; end if;
  if q.valid_until < current_date then raise exception 'The quotation has expired'; end if;
  if exists (select 1 from payments where order_id = p_order and pay_type = 'deposit') then
    raise exception 'Deposit slip already sent, waiting for the shop to verify it'; end if;
  insert into payments (order_id, amount, pay_type, payment_method, slip_path, verified)
  values (p_order, q.deposit_amount, 'deposit', p_method, p_slip, false);
  update quotations set status = 'accepted', responded_at = now() where quotation_id = q.quotation_id;
end $$;
create or replace function public.customer_cancel_order(p_order bigint, p_reason text, p_refund_account text)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; dep numeric;
begin
  select * into o from orders where order_id = p_order and customer_id = my_customer_id();
  if not found then raise exception 'Order not found'; end if;
  if o.status not in (0,1,2,3) then raise exception 'Cannot cancel: production has started. Please contact the shop'; end if;
  select amount into dep from payments where order_id = p_order and pay_type = 'deposit' and verified limit 1;
  update orders set status = 99, cancel_reason = p_reason, cancelled_at = now(), cancelled_by = 'customer'
   where order_id = p_order;
  if dep is not null then
    insert into payments (order_id, amount, pay_type, refund_account, verified)
    values (p_order, dep, 'refund', p_refund_account, false);
  end if;
end $$;
create or replace function public.customer_submit_acceptance(p_order bigint, p_passed boolean, p_note text, p_method text, p_slip text)
returns void language plpgsql security definer set search_path = public as $$
declare q quotations%rowtype; dep numeric;
begin
  perform 1 from orders where order_id = p_order and customer_id = my_customer_id() and status = 9;
  if not found then raise exception 'This order has not reached the acceptance step yet'; end if;
  insert into acceptance_checks (order_id, passed, note) values (p_order, p_passed, p_note);
  if p_passed then
    select * into q from quotations where order_id = p_order and status = 'accepted' order by created_at desc limit 1;
    select coalesce(sum(amount),0) into dep from payments where order_id = p_order and pay_type = 'deposit' and verified;
    if exists (select 1 from payments where order_id = p_order and pay_type = 'final') then
      raise exception 'Payment slip already sent, waiting for the shop to verify it'; end if;
    insert into payments (order_id, amount, pay_type, payment_method, slip_path, verified)
    values (p_order, q.total_price - dep, 'final', p_method, p_slip, false);
  else
    update appointments set status = 'rescheduled', reschedule_count = reschedule_count + 1, reschedule_reason = p_note
     where order_id = p_order and status = 'scheduled';
    update orders set status = 8 where order_id = p_order;
  end if;
end $$;
create or replace function public.demo_step(p_order bigint) returns smallint
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; q quotations%rowtype; fid bigint; dep numeric; base numeric; mname text;
begin
  select * into o from orders where order_id = p_order and customer_id = my_customer_id() for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status = 0 then
    select price, name into base, mname from machine_models where model_id = o.model_id;
    base := coalesce(base, 150000);
    insert into quotations (order_id, subtotal, vat, total_price, deposit_amount, valid_until)
    select p_order, base, round(base * 0.07, 2), round(base * 1.07, 2),
      round(base * 1.07 * (select value from business_rules where rule_key = 'deposit_percent') / 100, 2),
      current_date + (select value::int from business_rules where rule_key = 'quote_valid_days')
    returning * into q;
    insert into quotation_items (quotation_id, description, amount)
    values (q.quotation_id, coalesce(mname, 'Ice machine') || ' · ' || o.machine_type || ' ' || o.capacity, base);
    update orders set status = 1 where order_id = p_order;
  elsif o.status = 1 then
    if exists (select 1 from payments where order_id = p_order and pay_type = 'deposit') then
      update payments set verified = true where order_id = p_order and pay_type = 'deposit';
    else
      insert into payments (order_id, amount, pay_type, payment_method, verified)
      select p_order, deposit_amount, 'deposit', 'transfer', true from quotations
       where order_id = p_order order by created_at desc limit 1;
    end if;
    update quotations set status = 'accepted', responded_at = coalesce(responded_at, now())
     where order_id = p_order and status = 'sent';
    update orders set status = 2 where order_id = p_order;
  elsif o.status = 2 then
    select factory_id into fid from factories where is_active order by factory_id limit 1;
    insert into factory_assignments (order_id, factory_id) values (p_order, fid);
    update orders set status = 3, factory_id = fid, sent_at = now() where order_id = p_order;
  elsif o.status = 3 then
    update factory_assignments set response = 'accepted', responded_at = now() where order_id = p_order and response = 'pending';
    insert into production_updates (order_id, stage, est_finish_date, note)
    values (p_order, 'started', current_date + 14, 'Production started');
    update orders set status = 4, started_at = now(), est_finish_date = current_date + 14 where order_id = p_order;
  elsif o.status = 4 then
    insert into production_updates (order_id, stage, note) values (p_order, 'finished', 'Production finished');
    update orders set status = 5, finished_at = now() where order_id = p_order;
  elsif o.status = 5 then
    insert into qc_results (order_id, factory_id, round_no, item_id, passed)
    select p_order, o.factory_id, 1, item_id, true from qc_items where is_active;
    update orders set status = 7 where order_id = p_order;
  elsif o.status = 7 then
    insert into appointments (order_id, install_datetime) values (p_order, now() + interval '3 days');
    update orders set status = 8 where order_id = p_order;
  elsif o.status = 8 then
    if exists (select 1 from appointments where order_id = p_order and status = 'scheduled') then
      update appointments set status = 'completed' where order_id = p_order and status = 'scheduled';
    else
      insert into appointments (order_id, install_datetime, status) values (p_order, now(), 'completed');
    end if;
    update orders set status = 9, installed_at = now() where order_id = p_order;
  elsif o.status = 9 then
    select * into q from quotations where order_id = p_order and status = 'accepted' order by created_at desc limit 1;
    select coalesce(sum(amount),0) into dep from payments where order_id = p_order and pay_type = 'deposit' and verified;
    if exists (select 1 from payments where order_id = p_order and pay_type = 'final') then
      update payments set verified = true, receipt_no = 'RC-' || o.order_code where order_id = p_order and pay_type = 'final';
    else
      insert into payments (order_id, amount, pay_type, payment_method, verified, receipt_no)
      values (p_order, q.total_price - dep, 'final', 'transfer', true, 'RC-' || o.order_code);
    end if;
    if not exists (select 1 from acceptance_checks where order_id = p_order and passed) then
      insert into acceptance_checks (order_id, passed) values (p_order, true);
    end if;
    update orders set status = 10, accepted_at = now() where order_id = p_order;
  else
    raise exception 'This order has no next step (status %)', o.status;
  end if;
  return (select status from orders where order_id = p_order);
end $$;
create or replace function public.demo_advance_to(p_order bigint, p_target smallint) returns smallint
language plpgsql security definer set search_path = public as $$
declare s smallint;
begin
  select status into s from orders where order_id = p_order and customer_id = my_customer_id();
  if s is null then raise exception 'Order not found'; end if;
  while s < p_target and s < 10 loop
    -- a rework loop (6) never occurs on the demo path; step 5 goes straight to 7
    s := demo_step(p_order);
  end loop;
  return s;
end $$;
create or replace function public.staff_create_quote(p_order bigint, p_items jsonb,
  p_vat_percent numeric default 7, p_deposit_percent numeric default null, p_valid_days int default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; sub numeric; q quotations%rowtype; pct numeric; days int;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 0 then raise exception 'A quotation can only be issued for a new order'; end if;
  select coalesce(sum((i->>'amount')::numeric), 0) into sub from jsonb_array_elements(p_items) i;
  if sub <= 0 then raise exception 'Please enter the items and prices'; end if;
  pct  := coalesce(p_deposit_percent, (select value from business_rules where rule_key = 'deposit_percent'));
  days := coalesce(p_valid_days, (select value::int from business_rules where rule_key = 'quote_valid_days'));
  insert into quotations (order_id, subtotal, vat, total_price, deposit_amount, valid_until, created_by)
  values (p_order, sub, round(sub * p_vat_percent / 100, 2), round(sub * (1 + p_vat_percent / 100), 2),
          round(sub * (1 + p_vat_percent / 100) * pct / 100, 2), current_date + days, my_user_id())
  returning * into q;
  insert into quotation_items (quotation_id, description, amount)
  select q.quotation_id, i->>'description', (i->>'amount')::numeric from jsonb_array_elements(p_items) i;
  update orders set status = 1 where order_id = p_order;
  return q.quotation_id;
end $$;
create or replace function public.staff_verify_payment(p_payment bigint, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare pay payments%rowtype; o orders%rowtype;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select * into pay from payments where payment_id = p_payment for update;
  if not found then raise exception 'Payment not found'; end if;
  if pay.verified then raise exception 'Already verified'; end if;
  if pay.pay_type = 'refund' then raise exception 'Refunds use staff_confirm_refund'; end if;
  select * into o from orders where order_id = pay.order_id for update;
  if p_approve then
    update payments set verified = true, verified_by = my_user_id() where payment_id = p_payment;
    if pay.pay_type = 'deposit' then
      if o.status <> 1 then raise exception 'The order is not waiting for a deposit'; end if;
      update orders set status = 2 where order_id = o.order_id;
    else
      if o.status <> 9 then raise exception 'The order has not reached the final payment step'; end if;
      update payments set receipt_no = 'RC-' || o.order_code where payment_id = p_payment;
      update orders set status = 10, accepted_at = now() where order_id = o.order_id;
    end if;
  else
    if coalesce(trim(p_reason), '') = '' then raise exception 'Please give the reason it was rejected'; end if;
    delete from payments where payment_id = p_payment; -- customer submits again
    if pay.pay_type = 'deposit' then
      update quotations set status = 'sent', responded_at = null where order_id = o.order_id and status = 'accepted';
    end if;
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (o.order_id, 'customer', o.customer_id, o.order_code || ' · Payment proof rejected: ' || p_reason || ' Please send it again');
  end if;
end $$;
create or replace function public.staff_send_to_factory(p_order bigint, p_factory bigint)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status not in (2, 3) then raise exception 'Only orders with a paid deposit can be sent to a factory'; end if;
  if not exists (select 1 from factories where factory_id = p_factory and is_active) then raise exception 'No active factory found'; end if;
  if o.status = 3 then
    if exists (select 1 from factory_assignments where order_id = p_order and response = 'pending') then
      raise exception 'Still waiting for the factory to reply'; end if;
    if exists (select 1 from factory_assignments where order_id = p_order and response = 'accepted') then
      raise exception 'The factory has already accepted'; end if;
  end if;
  insert into factory_assignments (order_id, factory_id, sent_by) values (p_order, p_factory, my_user_id());
  update orders set factory_id = p_factory, sent_at = now(), status = 3 where order_id = p_order;
end $$;
create or replace function public.staff_factory_response(p_order bigint, p_accept boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  if not p_accept and coalesce(trim(p_reason), '') = '' then raise exception 'Please give the reason the factory declined'; end if;
  update factory_assignments
     set response = case when p_accept then 'accepted' else 'rejected' end,
         reject_reason = case when p_accept then null else p_reason end, responded_at = now()
   where order_id = p_order and response = 'pending';
  if not found then raise exception 'There is no production order waiting for a factory reply'; end if;
end $$;
create or replace function public.staff_production(p_order bigint, p_stage text, p_est date default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
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
create or replace function public.staff_qc_submit(p_order bigint, p_results jsonb)
returns smallint language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; rnd int; n_items int; n_given int; all_ok boolean;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 5 then raise exception 'The order is not waiting for QC'; end if;
  select count(*) into n_items from qc_items where is_active;
  select count(distinct (r->>'item_id')) into n_given from jsonb_array_elements(p_results) r
   where (r->>'item_id')::bigint in (select item_id from qc_items where is_active);
  if n_given <> n_items then raise exception 'Please check every item'; end if;
  select coalesce(max(round_no), 0) + 1 into rnd from qc_results where order_id = p_order;
  insert into qc_results (order_id, factory_id, round_no, item_id, passed, note, checked_by)
  select p_order, o.factory_id, rnd, (r->>'item_id')::bigint, (r->>'passed')::boolean, r->>'note', my_user_id()
  from jsonb_array_elements(p_results) r
  where (r->>'item_id')::bigint in (select item_id from qc_items where is_active);
  select bool_and((r->>'passed')::boolean) into all_ok from jsonb_array_elements(p_results) r;
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
  if not is_staff() then raise exception 'Not authorised'; end if;
  update orders set status = 5 where order_id = p_order and status = 6;
  if not found then raise exception 'The order is not in the QC fix step'; end if;
end $$;
create or replace function public.staff_schedule_install(p_order bigint, p_datetime timestamptz, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status not in (7, 8) then raise exception 'An install date can only be set after QC has passed'; end if;
  update appointments set status = 'rescheduled', reschedule_count = reschedule_count + 1, reschedule_reason = p_reason
   where order_id = p_order and status = 'scheduled';
  insert into appointments (order_id, install_datetime, reschedule_count, created_by)
  values (p_order, p_datetime, coalesce((select max(reschedule_count) from appointments where order_id = p_order), 0), my_user_id());
  if o.status = 7 then update orders set status = 8 where order_id = p_order; end if;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'customer', o.customer_id, o.order_code || ' · Install scheduled ' || to_char(p_datetime at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI'));
end $$;
create or replace function public.staff_confirm_installed(p_order bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  perform 1 from orders where order_id = p_order and status = 8 for update;
  if not found then raise exception 'The order is not in the install-scheduled step'; end if;
  if not exists (select 1 from appointments where order_id = p_order and status = 'scheduled') then
    raise exception 'There is no install date yet'; end if;
  update appointments set status = 'completed' where order_id = p_order and status = 'scheduled';
  update orders set status = 9, installed_at = now() where order_id = p_order;
end $$;
create or replace function public.staff_cancel_order(p_order bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; dep numeric;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Please enter a reason'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status not in (0, 1, 2, 3) then raise exception 'Cannot cancel: production has started'; end if;
  select amount into dep from payments where order_id = p_order and pay_type = 'deposit' and verified limit 1;
  update orders set status = 99, cancel_reason = p_reason, cancelled_at = now(), cancelled_by = 'shop' where order_id = p_order;
  if dep is not null then
    insert into payments (order_id, amount, pay_type, verified) values (p_order, dep, 'refund', false);
  end if;
end $$;
create or replace function public.staff_confirm_refund(p_payment bigint, p_account text, p_slip text)
returns void language plpgsql security definer set search_path = public as $$
declare pay payments%rowtype; o orders%rowtype;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select * into pay from payments where payment_id = p_payment and pay_type = 'refund' and not verified for update;
  if not found then raise exception 'No pending refund found'; end if;
  if coalesce(trim(coalesce(p_account, pay.refund_account)), '') = '' then raise exception 'Please enter the customer''s account'; end if;
  if p_slip is null then raise exception 'Please attach the refund transfer slip'; end if;
  update payments set verified = true, verified_by = my_user_id(), refund_account = coalesce(nullif(trim(p_account), ''), refund_account),
    slip_path = p_slip, paid_at = now() where payment_id = p_payment;
  select * into o from orders where order_id = pay.order_id;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (o.order_id, 'customer', o.customer_id, o.order_code || ' · Deposit refunded');
end $$;
