create table public.machine_models (
  model_id bigint generated always as identity primary key,
  code text not null unique,
  name text not null,
  machine_type text not null,
  capacity text not null,
  price numeric not null check (price >= 0),
  description text,
  is_active boolean not null default true
);
alter table public.machine_models enable row level security;
create policy "signed-in reads catalog" on public.machine_models for select to authenticated using (is_active);

alter table public.orders add column model_id bigint references public.machine_models (model_id);

-- SAMPLE data: placeholder models and prices, replace with the real catalog
insert into public.machine_models (code, name, machine_type, capacity, price, description) values
 ('IF-T05', 'ICEFLOW T-500', 'เครื่องทำน้ำแข็งหลอด', '500 กก./วัน', 95000,  'ขนาดเล็ก เหมาะร้านค้าและร้านอาหาร'),
 ('IF-T10', 'ICEFLOW T-1000', 'เครื่องทำน้ำแข็งหลอด', '1 ตัน/วัน', 150000, 'ขนาดกลาง ใช้งานต่อเนื่องได้ทั้งวัน'),
 ('IF-T20', 'ICEFLOW T-2000', 'เครื่องทำน้ำแข็งหลอด', '2 ตัน/วัน', 260000, 'กำลังผลิตสูง สำหรับโรงน้ำแข็งขนาดเล็ก'),
 ('IF-F10', 'ICEFLOW F-1000', 'เครื่องทำน้ำแข็งเกล็ด', '1 ตัน/วัน', 185000, 'น้ำแข็งเกล็ดละเอียด เหมาะอาหารทะเลและตลาดสด'),
 ('IF-F20', 'ICEFLOW F-2000', 'เครื่องทำน้ำแข็งเกล็ด', '2 ตัน/วัน', 320000, 'เกล็ดละเอียด กำลังผลิตสูง'),
 ('IF-C05', 'ICEFLOW C-500', 'เครื่องทำน้ำแข็งก้อน', '500 กก./วัน', 120000, 'น้ำแข็งก้อนใส เหมาะร้านเครื่องดื่ม');

-- demo quote now prices from the chosen model
create or replace function public.demo_step(p_order bigint) returns smallint
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; q quotations%rowtype; fid bigint; dep numeric; base numeric; mname text;
begin
  select * into o from orders where order_id = p_order and customer_id = my_customer_id() for update;
  if not found then raise exception 'ไม่พบออเดอร์'; end if;
  if o.status = 0 then
    select price, name into base, mname from machine_models where model_id = o.model_id;
    base := coalesce(base, 150000);
    insert into quotations (order_id, subtotal, vat, total_price, deposit_amount, valid_until)
    select p_order, base, round(base * 0.07, 2), round(base * 1.07, 2),
      round(base * 1.07 * (select value from business_rules where rule_key = 'deposit_percent') / 100, 2),
      current_date + (select value::int from business_rules where rule_key = 'quote_valid_days')
    returning * into q;
    insert into quotation_items (quotation_id, description, amount)
    values (q.quotation_id, coalesce(mname, 'เครื่องทำน้ำแข็ง') || ' · ' || o.machine_type || ' ' || o.capacity, base);
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
revoke all on function public.demo_step(bigint) from public, anon;
grant execute on function public.demo_step(bigint) to authenticated;
