-- helper
create or replace function public.my_customer_id() returns bigint
language sql stable security definer set search_path = public as
$$ select customer_id from customers where auth_id = auth.uid() $$;

-- UC8: signup creates the customers row
create or replace function public.handle_new_customer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into customers (auth_id, name, phone, email)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)),
          coalesce(new.raw_user_meta_data->>'phone',''),
          new.email)
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists trg_new_customer on auth.users;
create trigger trg_new_customer after insert on auth.users
  for each row execute function public.handle_new_customer();

-- every status change notifies the customer
create or replace function public.notify_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into notifications (order_id, recipient_type, recipient_id, message)
    select new.order_id, 'customer', new.customer_id, new.order_code || ' · ' || s.description
    from order_statuses s where s.status_code = new.status;
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_status on orders;
create trigger trg_notify_status after insert or update of status on orders
  for each row execute function public.notify_status();

-- customer read policies
create policy "customer own quotations" on quotations for select
  using (order_id in (select order_id from orders where customer_id = my_customer_id()));
create policy "customer own quotation items" on quotation_items for select
  using (quotation_id in (select q.quotation_id from quotations q join orders o on o.order_id = q.order_id where o.customer_id = my_customer_id()));
create policy "customer own payments" on payments for select
  using (order_id in (select order_id from orders where customer_id = my_customer_id()));
create policy "customer own appointments" on appointments for select
  using (order_id in (select order_id from orders where customer_id = my_customer_id()));
create policy "customer own production" on production_updates for select
  using (order_id in (select order_id from orders where customer_id = my_customer_id()));
create policy "customer own acceptance" on acceptance_checks for select
  using (order_id in (select order_id from orders where customer_id = my_customer_id()));
create policy "customer own notifications" on notifications for select
  using (recipient_type = 'customer' and recipient_id = my_customer_id());

-- storage: private slips, one folder per auth user
create policy "customer uploads own slips" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-slips' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "customer reads own slips" on storage.objects for select to authenticated
  using (bucket_id = 'payment-slips' and (storage.foldername(name))[1] = auth.uid()::text);

-- UC9: accept quotation + deposit slip
create or replace function public.customer_accept_quote(p_order bigint, p_method text, p_slip text)
returns void language plpgsql security definer set search_path = public as $$
declare q quotations%rowtype;
begin
  perform 1 from orders where order_id = p_order and customer_id = my_customer_id() and status = 1;
  if not found then raise exception 'ออเดอร์นี้ไม่อยู่ในขั้นรอยืนยันราคา'; end if;
  select * into q from quotations where order_id = p_order and status = 'sent' order by created_at desc limit 1;
  if not found then raise exception 'ไม่พบใบเสนอราคา'; end if;
  if q.valid_until < current_date then raise exception 'ใบเสนอราคาหมดอายุแล้ว'; end if;
  if exists (select 1 from payments where order_id = p_order and pay_type = 'deposit') then
    raise exception 'ส่งหลักฐานมัดจำแล้ว รอร้านตรวจสอบ'; end if;
  insert into payments (order_id, amount, pay_type, payment_method, slip_path, verified)
  values (p_order, q.deposit_amount, 'deposit', p_method, p_slip, false);
  update quotations set status = 'accepted', responded_at = now() where quotation_id = q.quotation_id;
end $$;

-- UC11: cancel (+ refund request when a deposit was verified)
create or replace function public.customer_cancel_order(p_order bigint, p_reason text, p_refund_account text)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; dep numeric;
begin
  select * into o from orders where order_id = p_order and customer_id = my_customer_id();
  if not found then raise exception 'ไม่พบออเดอร์'; end if;
  if o.status not in (0,1,2,3) then raise exception 'ยกเลิกไม่ได้ เพราะเริ่มผลิตแล้ว กรุณาติดต่อร้าน'; end if;
  select amount into dep from payments where order_id = p_order and pay_type = 'deposit' and verified limit 1;
  update orders set status = 99, cancel_reason = p_reason, cancelled_at = now(), cancelled_by = 'customer'
   where order_id = p_order;
  if dep is not null then
    insert into payments (order_id, amount, pay_type, refund_account, verified)
    values (p_order, dep, 'refund', p_refund_account, false);
  end if;
end $$;

-- UC7: acceptance check + final payment
create or replace function public.customer_submit_acceptance(p_order bigint, p_passed boolean, p_note text, p_method text, p_slip text)
returns void language plpgsql security definer set search_path = public as $$
declare q quotations%rowtype; dep numeric;
begin
  perform 1 from orders where order_id = p_order and customer_id = my_customer_id() and status = 9;
  if not found then raise exception 'ออเดอร์นี้ยังไม่ถึงขั้นตรวจรับ'; end if;
  insert into acceptance_checks (order_id, passed, note) values (p_order, p_passed, p_note);
  if p_passed then
    select * into q from quotations where order_id = p_order and status = 'accepted' order by created_at desc limit 1;
    select coalesce(sum(amount),0) into dep from payments where order_id = p_order and pay_type = 'deposit' and verified;
    if exists (select 1 from payments where order_id = p_order and pay_type = 'final') then
      raise exception 'ส่งหลักฐานชำระแล้ว รอร้านตรวจสอบ'; end if;
    insert into payments (order_id, amount, pay_type, payment_method, slip_path, verified)
    values (p_order, q.total_price - dep, 'final', p_method, p_slip, false);
  else
    update appointments set status = 'rescheduled', reschedule_count = reschedule_count + 1, reschedule_reason = p_note
     where order_id = p_order and status = 'scheduled';
    update orders set status = 8 where order_id = p_order;
  end if;
end $$;

-- demo controls: stand in for the shop and the factory (customer's own order only)
create or replace function public.demo_step(p_order bigint) returns smallint
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; q quotations%rowtype; fid bigint; dep numeric;
begin
  select * into o from orders where order_id = p_order and customer_id = my_customer_id() for update;
  if not found then raise exception 'ไม่พบออเดอร์'; end if;
  if o.status = 0 then
    insert into quotations (order_id, subtotal, vat, total_price, deposit_amount, valid_until)
    select p_order, 150000, 10500, 160500,
      round(160500 * (select value from business_rules where rule_key = 'deposit_percent') / 100, 2),
      current_date + (select value::int from business_rules where rule_key = 'quote_valid_days')
    returning * into q;
    insert into quotation_items (quotation_id, description, amount)
    values (q.quotation_id, 'เครื่องทำน้ำแข็ง ' || o.machine_type || ' ' || o.capacity, 150000);
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
    values (p_order, 'started', current_date + 14, 'เริ่มผลิต');
    update orders set status = 4, started_at = now(), est_finish_date = current_date + 14 where order_id = p_order;
  elsif o.status = 4 then
    insert into production_updates (order_id, stage, note) values (p_order, 'finished', 'ผลิตเสร็จ');
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
    raise exception 'ออเดอร์นี้ไม่มีขั้นถัดไป (status %)', o.status;
  end if;
  return (select status from orders where order_id = p_order);
end $$;

create or replace function public.demo_advance_to(p_order bigint, p_target smallint) returns smallint
language plpgsql security definer set search_path = public as $$
declare s smallint;
begin
  select status into s from orders where order_id = p_order and customer_id = my_customer_id();
  if s is null then raise exception 'ไม่พบออเดอร์'; end if;
  while s < p_target and s < 10 loop
    -- a rework loop (6) never occurs on the demo path; step 5 goes straight to 7
    s := demo_step(p_order);
  end loop;
  return s;
end $$;

revoke all on function public.my_customer_id(), public.customer_accept_quote(bigint,text,text),
  public.customer_cancel_order(bigint,text,text), public.customer_submit_acceptance(bigint,boolean,text,text,text),
  public.demo_step(bigint), public.demo_advance_to(bigint,smallint) from public, anon;
grant execute on function public.my_customer_id(), public.customer_accept_quote(bigint,text,text),
  public.customer_cancel_order(bigint,text,text), public.customer_submit_acceptance(bigint,boolean,text,text,text),
  public.demo_step(bigint), public.demo_advance_to(bigint,smallint) to authenticated;
revoke all on function public.handle_new_customer(), public.notify_status() from public, anon, authenticated;

-- seed reference data the demo needs
insert into factories (name, contact_name, phone, capacity_per_month)
select 'โรงงานน้ำแข็งไทย', 'คุณสมชาย', '02-000-0000', 20 where not exists (select 1 from factories);
insert into qc_items (item_name)
select v from (values ('ตรวจระบบทำความเย็นและการผลิตน้ำแข็ง'), ('ตรวจระบบไฟฟ้าและความปลอดภัย'), ('ตรวจรูปลักษณ์และการประกอบ')) t(v)
where not exists (select 1 from qc_items);
