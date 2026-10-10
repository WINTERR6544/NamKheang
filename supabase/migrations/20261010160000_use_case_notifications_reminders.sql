-- Bring the database in line with the use case descriptions (Word report, 2026-10-10)
--   UC4/UC5  notify the factory of a production order, notify the shop of the factory's reply
--   UC4      factory silent for factory_reply_days -> remind the factory and tell the shop (nightly job)
--   UC6      customer told the estimated finish date; factory reminded when the date is near (nightly job)
--   UC8      factory notified of the install date; reschedule needs reschedule_notice_days
--   UC11     customer notified with the cancel reason; a customer cancel needs a reason
--   UC12     shop told of a pending refund; customer can send the refund account afterwards
--   UC14     only Admin manages factories

-- ---------- helpers / columns ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from users where auth_id = auth.uid() and is_active and role = 'admin') $$;

alter table public.factory_assignments add column if not exists reminded_at timestamptz;
alter table public.orders add column if not exists finish_reminded_at timestamptz;

-- ---------- UC6 / UC11: customer messages carry the estimated finish date and the cancel reason ----------
create or replace function public.notify_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into notifications (order_id, recipient_type, recipient_id, message)
    select new.order_id, 'customer', new.customer_id,
           new.order_code || ' · ' || s.description ||
           case when new.status = 4 and new.est_finish_date is not null
                  then ' · Estimated finish ' || to_char(new.est_finish_date, 'DD/MM/YYYY')
                when new.status = 99 and coalesce(new.cancel_reason, '') <> ''
                  then ': ' || new.cancel_reason
                else '' end
    from order_statuses s where s.status_code = new.status;
  end if;
  return new;
end $$;

-- ---------- UC4 / UC5: tell the factory ----------
create or replace function public.staff_send_to_factory(p_order bigint, p_factory bigint)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; days int;
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
  select coalesce((select value::int from business_rules where rule_key = 'factory_reply_days'), 3) into days;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'factory', p_factory,
          o.order_code || ' · New production order. Please accept or decline within ' || days || ' days');
end $$;

-- ---------- UC4 / UC5: tell the shop the factory's reply ----------
create or replace function public.staff_factory_response(p_order bigint, p_accept boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a factory_assignments%rowtype; oc text; fname text;
begin
  if not is_factory() then raise exception 'Only the factory can reply to a production order'; end if;
  if not p_accept and coalesce(trim(p_reason), '') = '' then raise exception 'Please give the reason the factory declined'; end if;
  update factory_assignments
     set response = case when p_accept then 'accepted' else 'rejected' end,
         reject_reason = case when p_accept then null else p_reason end, responded_at = now()
   where order_id = p_order and response = 'pending' and factory_id = my_factory_id()
   returning * into a;
  if not found then raise exception 'There is no production order waiting for your reply'; end if;
  select order_code into oc from orders where order_id = p_order;
  select name into fname from factories where factory_id = a.factory_id;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'shop', 0,
          oc || ' · ' || coalesce(fname, 'The factory') ||
          case when p_accept then ' accepted the production order' else ' declined the production order: ' || p_reason end);
end $$;

-- ---------- UC6: a changed finish date re-arms the deadline reminder ----------
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
    update orders set status = 4, started_at = now(), est_finish_date = p_est, finish_reminded_at = null where order_id = p_order;
  elsif p_stage in ('in_progress', 'delayed') then
    if o.status <> 4 then raise exception 'The order is not in production'; end if;
    if p_est is not null then update orders set est_finish_date = p_est, finish_reminded_at = null where order_id = p_order; end if;
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

-- ---------- UC8: tell the factory, and enforce the reschedule notice ----------
create or replace function public.staff_schedule_install(p_order bigint, p_datetime timestamptz, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; cur appointments%rowtype; notice int; stamp text;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status not in (7, 8, 9) then raise exception 'An install date can only be set after QC has passed'; end if;
  if o.status = 9 and not exists (
       select 1 from acceptance_checks a where a.order_id = p_order and not a.passed
          and a.checked_at = (select max(checked_at) from acceptance_checks where order_id = p_order)) then
    raise exception 'The customer has not reported a problem'; end if;
  select coalesce((select value::int from business_rules where rule_key = 'reschedule_notice_days'), 1) into notice;
  select * into cur from appointments where order_id = p_order and status = 'scheduled' order by created_at desc limit 1;
  if found and cur.install_datetime < now() + make_interval(days => notice) then
    raise exception 'The current install date is less than % day(s) away. Rescheduling needs at least that much notice', notice;
  end if;
  update appointments set status = 'rescheduled', reschedule_count = reschedule_count + 1, reschedule_reason = p_reason
   where order_id = p_order and status = 'scheduled';
  insert into appointments (order_id, install_datetime, reschedule_count, created_by)
  values (p_order, p_datetime, coalesce((select max(reschedule_count) from appointments where order_id = p_order), 0), my_user_id());
  if o.status in (7, 9) then update orders set status = 8 where order_id = p_order; end if;
  stamp := to_char(p_datetime at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI');
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'customer', o.customer_id, o.order_code || ' · Install scheduled ' || stamp);
  if o.factory_id is not null then
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (p_order, 'factory', o.factory_id,
            o.order_code || case when o.status = 9 then ' · Fix visit scheduled ' else ' · Install scheduled ' end || stamp);
  end if;
end $$;

-- ---------- UC11 / UC12: reason required, shop told of a pending refund ----------
create or replace function public.customer_cancel_order(p_order bigint, p_reason text, p_refund_account text)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; dep numeric;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'Please enter a reason'; end if;
  select * into o from orders where order_id = p_order and customer_id = my_customer_id();
  if not found then raise exception 'Order not found'; end if;
  if o.status not in (0,1,2,3) then raise exception 'Cannot cancel: production has started. Please contact the shop'; end if;
  select amount into dep from payments where order_id = p_order and pay_type = 'deposit' and verified limit 1;
  update orders set status = 99, cancel_reason = p_reason, cancelled_at = now(), cancelled_by = 'customer'
   where order_id = p_order;
  update quotations set status = 'rejected', responded_at = now()
   where order_id = p_order and status = 'sent';
  if dep is not null then
    insert into payments (order_id, amount, pay_type, refund_account, verified)
    values (p_order, dep, 'refund', nullif(trim(coalesce(p_refund_account, '')), ''), false);
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (p_order, 'shop', 0, o.order_code || ' · The customer cancelled. A deposit refund of ' || dep || ' THB is pending');
  end if;
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
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (p_order, 'customer', o.customer_id, o.order_code || ' · Please send your bank account for the deposit refund of ' || dep || ' THB');
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (p_order, 'shop', 0, o.order_code || ' · A deposit refund of ' || dep || ' THB is pending');
  end if;
end $$;

-- UC12: the customer sends (or corrects) the refund account after the cancel
create or replace function public.customer_set_refund_account(p_order bigint, p_account text)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  if coalesce(trim(p_account), '') = '' then raise exception 'Please enter your bank account'; end if;
  select * into o from orders where order_id = p_order and customer_id = my_customer_id();
  if not found then raise exception 'Order not found'; end if;
  update payments set refund_account = trim(p_account)
   where order_id = p_order and pay_type = 'refund' and not verified;
  if not found then raise exception 'There is no pending refund for this order'; end if;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'shop', 0, o.order_code || ' · The customer sent the refund account');
end $$;
revoke execute on function public.customer_set_refund_account(bigint, text) from public, anon;
grant execute on function public.customer_set_refund_account(bigint, text) to authenticated;

-- the customer is already told with the reason by notify_status(); expiry only needs to tell the shop
create or replace function public.expire_quotes() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in
    select q.quotation_id, o.order_id, o.order_code
      from quotations q join orders o on o.order_id = q.order_id
     where q.status = 'sent' and q.valid_until < current_date and o.status = 1
       and q.quotation_id = (select max(quotation_id) from quotations where order_id = o.order_id)
       and not exists (select 1 from payments p where p.order_id = o.order_id and p.pay_type = 'deposit')
     for update of q, o
  loop
    update quotations set status = 'expired', responded_at = now() where quotation_id = r.quotation_id;
    update orders set status = 99, cancel_reason = 'Quotation expired', cancelled_at = now(), cancelled_by = 'system'
     where order_id = r.order_id;
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (r.order_id, 'shop', 0, r.order_code || ' · The quotation expired and the order was cancelled automatically');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.expire_quotes() from public, anon, authenticated;

-- ---------- UC4 exception: factory has not replied within factory_reply_days ----------
create or replace function public.remind_factories() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0; days int;
begin
  select coalesce((select value::int from business_rules where rule_key = 'factory_reply_days'), 3) into days;
  for r in
    select fa.assignment_id, fa.order_id, fa.factory_id, o.order_code, f.name as factory_name,
           greatest(1, floor(extract(epoch from (now() - fa.sent_at)) / 86400)::int) as waited
      from factory_assignments fa
      join orders o on o.order_id = fa.order_id and o.status = 3
      join factories f on f.factory_id = fa.factory_id
     where fa.response = 'pending' and fa.reminded_at is null
       and fa.sent_at < now() - make_interval(days => days)
     for update of fa
  loop
    update factory_assignments set reminded_at = now() where assignment_id = r.assignment_id;
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (r.order_id, 'factory', r.factory_id, r.order_code || ' · Reminder: please reply to the production order (waiting ' || r.waited || ' days)');
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (r.order_id, 'shop', 0, r.order_code || ' · ' || r.factory_name || ' has not replied for ' || r.waited || ' days');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.remind_factories() from public, anon, authenticated;

-- ---------- UC6 exception: the estimated finish date is today or tomorrow ----------
create or replace function public.remind_production_deadlines() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in
    select order_id, order_code, factory_id, est_finish_date from orders
     where status = 4 and est_finish_date is not null and est_finish_date <= current_date + 1
       and finish_reminded_at is null and factory_id is not null
     for update
  loop
    update orders set finish_reminded_at = now() where order_id = r.order_id;
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (r.order_id, 'factory', r.factory_id,
            r.order_code || ' · The estimated finish date is ' || to_char(r.est_finish_date, 'DD/MM/YYYY') || '. Please update the production status');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.remind_production_deadlines() from public, anon, authenticated;

-- ---------- UC14: only Admin manages factories (the shop role can still read them) ----------
drop policy if exists "staff manages factories" on public.factories;
create policy "staff reads factories" on public.factories for select to authenticated using (public.is_staff());
create policy "admin manages factories" on public.factories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
