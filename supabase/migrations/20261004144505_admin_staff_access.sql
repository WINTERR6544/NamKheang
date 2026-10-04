-- who is staff
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from users where auth_id = auth.uid() and is_active and role in ('admin','shop')) $$;
create or replace function public.my_user_id() returns bigint
language sql stable security definer set search_path = public as
$$ select user_id from users where auth_id = auth.uid() and is_active $$;

-- staff READ everything the shop needs; WRITES to orders/payments/etc. go through the staff_* functions below
do $$
declare t text;
begin
  foreach t in array array['orders','customers','order_status_logs','quotations','quotation_items','payments',
    'qc_results','appointments','factory_assignments','production_updates','acceptance_checks','notifications']
  loop
    execute format('create policy "staff reads %1$s" on public.%1$I for select to authenticated using (public.is_staff())', t);
  end loop;
  -- reference data the shop maintains directly
  foreach t in array array['factories','qc_items','machine_models']
  loop
    execute format('create policy "staff manages %1$s" on public.%1$I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;
create policy "staff reads users" on public.users for select to authenticated using (auth_id = auth.uid() or public.is_staff());

-- staff can view and add payment slips (deposit/final slips, refund slips)
create policy "staff reads slips" on storage.objects for select to authenticated
  using (bucket_id = 'payment-slips' and public.is_staff());
create policy "staff uploads slips" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-slips' and public.is_staff());

-- UC9: shop issues the quotation
create or replace function public.staff_create_quote(p_order bigint, p_items jsonb,
  p_vat_percent numeric default 7, p_deposit_percent numeric default null, p_valid_days int default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; sub numeric; q quotations%rowtype; pct numeric; days int;
begin
  if not is_staff() then raise exception 'ไม่มีสิทธิ์'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'ไม่พบออเดอร์'; end if;
  if o.status <> 0 then raise exception 'ออกใบเสนอราคาได้เฉพาะออเดอร์ใหม่'; end if;
  select coalesce(sum((i->>'amount')::numeric), 0) into sub from jsonb_array_elements(p_items) i;
  if sub <= 0 then raise exception 'กรุณาระบุรายการและราคา'; end if;
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

-- UC9 / UC7: verify a deposit or final slip (approve or reject)
create or replace function public.staff_verify_payment(p_payment bigint, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare pay payments%rowtype; o orders%rowtype;
begin
  if not is_staff() then raise exception 'ไม่มีสิทธิ์'; end if;
  select * into pay from payments where payment_id = p_payment for update;
  if not found then raise exception 'ไม่พบรายการชำระเงิน'; end if;
  if pay.verified then raise exception 'ตรวจสอบแล้ว'; end if;
  if pay.pay_type = 'refund' then raise exception 'การคืนเงินใช้ staff_confirm_refund'; end if;
  select * into o from orders where order_id = pay.order_id for update;
  if p_approve then
    update payments set verified = true, verified_by = my_user_id() where payment_id = p_payment;
    if pay.pay_type = 'deposit' then
      if o.status <> 1 then raise exception 'ออเดอร์ไม่อยู่ในขั้นรอมัดจำ'; end if;
      update orders set status = 2 where order_id = o.order_id;
    else
      if o.status <> 9 then raise exception 'ออเดอร์ยังไม่ถึงขั้นรับเงินส่วนที่เหลือ'; end if;
      update payments set receipt_no = 'RC-' || o.order_code where payment_id = p_payment;
      update orders set status = 10, accepted_at = now() where order_id = o.order_id;
    end if;
  else
    if coalesce(trim(p_reason), '') = '' then raise exception 'กรุณาระบุเหตุผลที่ไม่ผ่าน'; end if;
    delete from payments where payment_id = p_payment; -- customer submits again
    if pay.pay_type = 'deposit' then
      update quotations set status = 'sent', responded_at = null where order_id = o.order_id and status = 'accepted';
    end if;
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (o.order_id, 'customer', o.customer_id, o.order_code || ' · หลักฐานการชำระไม่ผ่าน: ' || p_reason || ' กรุณาส่งใหม่');
  end if;
end $$;

-- UC2 / UC3: send to a factory, or to another factory after a rejection
create or replace function public.staff_send_to_factory(p_order bigint, p_factory bigint)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  if not is_staff() then raise exception 'ไม่มีสิทธิ์'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'ไม่พบออเดอร์'; end if;
  if o.status not in (2, 3) then raise exception 'ส่งโรงงานได้เฉพาะออเดอร์ที่ชำระมัดจำแล้ว'; end if;
  if not exists (select 1 from factories where factory_id = p_factory and is_active) then raise exception 'ไม่พบโรงงานที่เปิดใช้งาน'; end if;
  if o.status = 3 then
    if exists (select 1 from factory_assignments where order_id = p_order and response = 'pending') then
      raise exception 'กำลังรอโรงงานตอบรับอยู่'; end if;
    if exists (select 1 from factory_assignments where order_id = p_order and response = 'accepted') then
      raise exception 'โรงงานรับผลิตแล้ว'; end if;
  end if;
  insert into factory_assignments (order_id, factory_id, sent_by) values (p_order, p_factory, my_user_id());
  update orders set factory_id = p_factory, sent_at = now(), status = 3 where order_id = p_order;
end $$;

-- record the factory's reply (shop records on behalf of the factory)
create or replace function public.staff_factory_response(p_order bigint, p_accept boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'ไม่มีสิทธิ์'; end if;
  if not p_accept and coalesce(trim(p_reason), '') = '' then raise exception 'กรุณาระบุเหตุผลที่โรงงานปฏิเสธ'; end if;
  update factory_assignments
     set response = case when p_accept then 'accepted' else 'rejected' end,
         reject_reason = case when p_accept then null else p_reason end, responded_at = now()
   where order_id = p_order and response = 'pending';
  if not found then raise exception 'ไม่มีคำสั่งผลิตที่รอโรงงานตอบ'; end if;
end $$;

-- UC4: production progress
create or replace function public.staff_production(p_order bigint, p_stage text, p_est date default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  if not is_staff() then raise exception 'ไม่มีสิทธิ์'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'ไม่พบออเดอร์'; end if;
  if p_stage = 'started' then
    if o.status <> 3 or not exists (select 1 from factory_assignments where order_id = p_order and response = 'accepted') then
      raise exception 'เริ่มผลิตได้เมื่อโรงงานรับผลิตแล้ว'; end if;
    if p_est is null then raise exception 'กรุณาระบุวันเสร็จโดยประมาณ'; end if;
    update orders set status = 4, started_at = now(), est_finish_date = p_est where order_id = p_order;
  elsif p_stage in ('in_progress', 'delayed') then
    if o.status <> 4 then raise exception 'ออเดอร์ไม่ได้อยู่ระหว่างผลิต'; end if;
    if p_est is not null then update orders set est_finish_date = p_est where order_id = p_order; end if;
    if p_stage = 'delayed' then
      insert into notifications (order_id, recipient_type, recipient_id, message)
      values (p_order, 'customer', o.customer_id, o.order_code || ' · การผลิตล่าช้า' ||
        coalesce(' วันเสร็จใหม่ ' || to_char(p_est, 'DD/MM/YYYY'), ''));
    end if;
  elsif p_stage = 'finished' then
    if o.status <> 4 then raise exception 'ออเดอร์ไม่ได้อยู่ระหว่างผลิต'; end if;
    update orders set status = 5, finished_at = now() where order_id = p_order;
  else
    raise exception 'ขั้นตอนไม่ถูกต้อง';
  end if;
  insert into production_updates (order_id, stage, est_finish_date, note, updated_by)
  values (p_order, p_stage, p_est, p_note, my_user_id());
end $$;

-- UC5: QC round. p_results = [{"item_id":1,"passed":true,"note":"..."}] covering every active item
create or replace function public.staff_qc_submit(p_order bigint, p_results jsonb)
returns smallint language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; rnd int; n_items int; n_given int; all_ok boolean;
begin
  if not is_staff() then raise exception 'ไม่มีสิทธิ์'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'ไม่พบออเดอร์'; end if;
  if o.status <> 5 then raise exception 'ออเดอร์ไม่ได้อยู่ในขั้นรอตรวจ QC'; end if;
  select count(*) into n_items from qc_items where is_active;
  select count(distinct (r->>'item_id')) into n_given from jsonb_array_elements(p_results) r
   where (r->>'item_id')::bigint in (select item_id from qc_items where is_active);
  if n_given <> n_items then raise exception 'กรุณาตรวจให้ครบทุกหัวข้อ'; end if;
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

-- factory fixed the QC findings (shop records on behalf)
create or replace function public.staff_rework_done(p_order bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'ไม่มีสิทธิ์'; end if;
  update orders set status = 5 where order_id = p_order and status = 6;
  if not found then raise exception 'ออเดอร์ไม่ได้อยู่ในขั้นแก้ไขตาม QC'; end if;
end $$;

-- UC6: set or move the install date
create or replace function public.staff_schedule_install(p_order bigint, p_datetime timestamptz, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  if not is_staff() then raise exception 'ไม่มีสิทธิ์'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'ไม่พบออเดอร์'; end if;
  if o.status not in (7, 8) then raise exception 'นัดติดตั้งได้หลังผ่าน QC เท่านั้น'; end if;
  update appointments set status = 'rescheduled', reschedule_count = reschedule_count + 1, reschedule_reason = p_reason
   where order_id = p_order and status = 'scheduled';
  insert into appointments (order_id, install_datetime, reschedule_count, created_by)
  values (p_order, p_datetime, coalesce((select max(reschedule_count) from appointments where order_id = p_order), 0), my_user_id());
  if o.status = 7 then update orders set status = 8 where order_id = p_order; end if;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'customer', o.customer_id, o.order_code || ' · นัดติดตั้ง ' || to_char(p_datetime at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI'));
end $$;

-- the factory confirmed the install is done (shop records on behalf)
create or replace function public.staff_confirm_installed(p_order bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'ไม่มีสิทธิ์'; end if;
  perform 1 from orders where order_id = p_order and status = 8 for update;
  if not found then raise exception 'ออเดอร์ไม่ได้อยู่ในขั้นนัดติดตั้ง'; end if;
  if not exists (select 1 from appointments where order_id = p_order and status = 'scheduled') then
    raise exception 'ยังไม่มีวันนัดติดตั้ง'; end if;
  update appointments set status = 'completed' where order_id = p_order and status = 'scheduled';
  update orders set status = 9, installed_at = now() where order_id = p_order;
end $$;

-- UC11 (shop side): cancel before production starts
create or replace function public.staff_cancel_order(p_order bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; dep numeric;
begin
  if not is_staff() then raise exception 'ไม่มีสิทธิ์'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'กรุณาระบุเหตุผล'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'ไม่พบออเดอร์'; end if;
  if o.status not in (0, 1, 2, 3) then raise exception 'ยกเลิกไม่ได้ เพราะเริ่มผลิตแล้ว'; end if;
  select amount into dep from payments where order_id = p_order and pay_type = 'deposit' and verified limit 1;
  update orders set status = 99, cancel_reason = p_reason, cancelled_at = now(), cancelled_by = 'shop' where order_id = p_order;
  if dep is not null then
    insert into payments (order_id, amount, pay_type, verified) values (p_order, dep, 'refund', false);
  end if;
end $$;

-- UC12: transfer the deposit back and attach the slip
create or replace function public.staff_confirm_refund(p_payment bigint, p_account text, p_slip text)
returns void language plpgsql security definer set search_path = public as $$
declare pay payments%rowtype; o orders%rowtype;
begin
  if not is_staff() then raise exception 'ไม่มีสิทธิ์'; end if;
  select * into pay from payments where payment_id = p_payment and pay_type = 'refund' and not verified for update;
  if not found then raise exception 'ไม่พบรายการคืนเงินที่รอดำเนินการ'; end if;
  if coalesce(trim(coalesce(p_account, pay.refund_account)), '') = '' then raise exception 'กรุณาระบุบัญชีลูกค้า'; end if;
  if p_slip is null then raise exception 'กรุณาแนบสลิปการโอนคืน'; end if;
  update payments set verified = true, verified_by = my_user_id(), refund_account = coalesce(nullif(trim(p_account), ''), refund_account),
    slip_path = p_slip, paid_at = now() where payment_id = p_payment;
  select * into o from orders where order_id = pay.order_id;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (o.order_id, 'customer', o.customer_id, o.order_code || ' · โอนคืนเงินมัดจำแล้ว');
end $$;

revoke all on function public.is_staff(), public.my_user_id(),
  public.staff_create_quote(bigint, jsonb, numeric, numeric, int), public.staff_verify_payment(bigint, boolean, text),
  public.staff_send_to_factory(bigint, bigint), public.staff_factory_response(bigint, boolean, text),
  public.staff_production(bigint, text, date, text), public.staff_qc_submit(bigint, jsonb),
  public.staff_rework_done(bigint), public.staff_schedule_install(bigint, timestamptz, text),
  public.staff_confirm_installed(bigint), public.staff_cancel_order(bigint, text),
  public.staff_confirm_refund(bigint, text, text) from public, anon;
grant execute on function public.is_staff(), public.my_user_id(),
  public.staff_create_quote(bigint, jsonb, numeric, numeric, int), public.staff_verify_payment(bigint, boolean, text),
  public.staff_send_to_factory(bigint, bigint), public.staff_factory_response(bigint, boolean, text),
  public.staff_production(bigint, text, date, text), public.staff_qc_submit(bigint, jsonb),
  public.staff_rework_done(bigint), public.staff_schedule_install(bigint, timestamptz, text),
  public.staff_confirm_installed(bigint), public.staff_cancel_order(bigint, text),
  public.staff_confirm_refund(bigint, text, text) to authenticated;
