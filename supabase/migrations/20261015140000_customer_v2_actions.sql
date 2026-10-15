-- Customer site actions that customer/js/services/* calls but the database did not have.
-- Same rules as the older customer_* functions (status checks, payments, refunds, notifications);
-- errors raise the codes customer/js/customer_errors.js turns into Thai messages.
--   customer_confirm_quote_v2       accept the latest quote (deposit is paid on the next page)
--   customer_submit_payment_v2      send a deposit or final payment slip
--   customer_record_acceptance_v2   pass the install, or report a problem
--   customer_cancel_order_v2        cancel before production; opens a refund when a deposit was verified
--   customer_refund_account_v2      bank account for a pending refund
--   customer_request_reschedule_v2  ask the shop to move a booked install (+ table customer_reschedule_requests)

-- ---------------------------------------------------------------- reschedule requests (customer)
create table if not exists public.customer_reschedule_requests (
  request_id         bigint generated always as identity primary key,
  order_id           bigint not null references public.orders(order_id) on delete cascade,
  customer_id        bigint not null references public.customers(customer_id),
  appointment_id     bigint references public.appointments(appointment_id) on delete set null,
  preferred_datetime timestamptz not null,
  reason             text not null check (length(reason) between 5 and 1000),
  status             text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at         timestamptz not null default now(),
  resolved_at        timestamptz
);
create index if not exists customer_reschedule_requests_order_idx on public.customer_reschedule_requests (order_id);
create index if not exists customer_reschedule_requests_customer_idx on public.customer_reschedule_requests (customer_id);
create index if not exists customer_reschedule_requests_appointment_idx on public.customer_reschedule_requests (appointment_id);
create unique index if not exists customer_reschedule_requests_one_pending
  on public.customer_reschedule_requests (order_id) where status = 'pending';

alter table public.customer_reschedule_requests enable row level security;
revoke all on public.customer_reschedule_requests from anon, authenticated;
grant select on public.customer_reschedule_requests to authenticated; -- rows added only by the function below

drop policy if exists "customer reads own reschedule requests" on public.customer_reschedule_requests;
create policy "customer reads own reschedule requests" on public.customer_reschedule_requests
  for select to authenticated using (customer_id = (select public.my_customer_id()));
drop policy if exists "staff reads customer reschedule requests" on public.customer_reschedule_requests;
create policy "staff reads customer reschedule requests" on public.customer_reschedule_requests
  for select to authenticated using ((select public.is_staff()));

-- a new appointment from the shop answers every pending request (factory and customer)
create or replace function public.resolve_reschedule_requests() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update install_reschedule_requests set status = 'resolved', resolved_at = now()
   where order_id = new.order_id and status = 'pending';
  update customer_reschedule_requests set status = 'resolved', resolved_at = now()
   where order_id = new.order_id and status = 'pending';
  return new;
end $$;

-- ---------------------------------------------------------------- helpers
-- the signed-in customer's order, locked; raises ORDER_NOT_FOUND for anyone else's
create or replace function public.customer_own_order_v2(p_order bigint) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  select * into o from orders where order_id = p_order and customer_id = customer_active_id_v2() for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  return o;
end $$;

create or replace function public.customer_bangkok_today_v2() returns date
language sql stable set search_path = public as $$ select (now() at time zone 'Asia/Bangkok')::date $$;

-- ---------------------------------------------------------------- 1. accept the quote
create or replace function public.customer_confirm_quote_v2(p_order bigint) returns void
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype := customer_own_order_v2(p_order); q quotations%rowtype;
begin
  if o.status <> 1 then raise exception 'WRONG_STATUS'; end if;
  select * into q from quotations where order_id = p_order order by created_at desc, quotation_id desc limit 1;
  if not found or q.status <> 'sent' then raise exception 'WRONG_STATUS'; end if;
  if q.valid_until < customer_bangkok_today_v2() then raise exception 'QUOTE_EXPIRED'; end if;
  update quotations set status = 'accepted', responded_at = now() where quotation_id = q.quotation_id;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'shop', 0, o.order_code || ' · The customer accepted the quotation; the deposit slip comes next');
end $$;

-- ---------------------------------------------------------------- 2. deposit / final payment slip
create or replace function public.customer_submit_payment_v2(
  p_order bigint, p_type text, p_method text, p_slip text, p_amount numeric, p_paid_at timestamptz
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  o orders%rowtype := customer_own_order_v2(p_order);
  q quotations%rowtype; a acceptance_checks%rowtype;
  due numeric; slip text := nullif(trim(coalesce(p_slip, '')), ''); id bigint;
begin
  if p_type not in ('deposit', 'final') or p_method not in ('transfer', 'qr', 'cash') then
    raise exception 'WRONG_STATUS'; end if;
  if p_paid_at is null or p_paid_at > now() + interval '5 minutes' or p_paid_at < now() - interval '90 days' then
    raise exception 'INVALID_PAYMENT_DATE'; end if;
  -- a slip is required except for cash, and must be the caller's own upload
  if p_method <> 'cash' and (slip is null
      or split_part(slip, '/', 1) <> auth.uid()::text
      or not exists (select 1 from storage.objects where bucket_id = 'payment-slips' and name = slip)) then
    raise exception 'INVALID_SLIP'; end if;
  if p_method = 'cash' then slip := null; end if;
  if exists (select 1 from payments where order_id = p_order and pay_type = p_type) then
    raise exception 'PAYMENT_PENDING'; end if;

  select * into q from quotations where order_id = p_order order by created_at desc, quotation_id desc limit 1;
  if not found or q.status <> 'accepted' then raise exception 'WRONG_STATUS'; end if;

  if p_type = 'deposit' then
    if o.status <> 1 then raise exception 'WRONG_STATUS'; end if;
    if q.valid_until < customer_bangkok_today_v2() then raise exception 'QUOTE_EXPIRED'; end if;
    due := q.deposit_amount;
  else
    if o.status <> 9 then raise exception 'WRONG_STATUS'; end if;
    -- the latest check must be a pass made after the latest install (a repair needs a new check)
    select * into a from acceptance_checks where order_id = p_order order by checked_at desc, check_id desc limit 1;
    if not found or not a.passed or (o.installed_at is not null and a.checked_at < o.installed_at) then
      raise exception 'ACCEPTANCE_REQUIRED'; end if;
    due := greatest(0, q.total_price - coalesce((select sum(amount) from payments
             where order_id = p_order and pay_type = 'deposit' and verified), 0));
  end if;
  if due <= 0 or p_amount is null or round(p_amount, 2) <> round(due, 2) then raise exception 'INVALID_AMOUNT'; end if;

  insert into payments (order_id, amount, pay_type, payment_method, slip_path, verified, paid_at)
  values (p_order, due, p_type, p_method, slip, false, p_paid_at) returning payment_id into id;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'shop', 0, o.order_code || ' · The customer sent a ' || p_type || ' payment of ' || due || ' THB to verify');
  return id;
end $$;

-- ---------------------------------------------------------------- 3. acceptance after install
create or replace function public.customer_record_acceptance_v2(p_order bigint, p_passed boolean, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype := customer_own_order_v2(p_order); n text := nullif(trim(coalesce(p_note, '')), '');
begin
  if o.status <> 9 then raise exception 'WRONG_STATUS'; end if;
  if p_passed is null then raise exception 'WRONG_STATUS'; end if;
  if not p_passed and (n is null or length(n) < 5 or length(n) > 1000) then raise exception 'INVALID_NOTE'; end if;
  if n is not null and length(n) > 1000 then raise exception 'INVALID_NOTE'; end if;
  insert into acceptance_checks (order_id, passed, note) values (p_order, p_passed, n);
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'shop', 0, o.order_code || case when p_passed
    then ' · The customer accepted the install; the final payment comes next'
    else ' · Customer reported a problem: ' || n end);
end $$;

-- ---------------------------------------------------------------- 4. cancel before production
create or replace function public.customer_cancel_order_v2(p_order bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype := customer_own_order_v2(p_order); r text := nullif(trim(coalesce(p_reason, '')), ''); dep numeric;
begin
  if r is null or length(r) < 5 or length(r) > 1000 then raise exception 'INVALID_NOTE'; end if;
  if o.status not in (0, 1, 2, 3) then raise exception 'PRODUCTION_STARTED'; end if;
  -- the shop checks a sent deposit slip first, so the refund amount is right
  if exists (select 1 from payments where order_id = p_order and pay_type = 'deposit' and not verified) then
    raise exception 'PAYMENT_PENDING'; end if;
  select coalesce(sum(amount), 0) into dep from payments where order_id = p_order and pay_type = 'deposit' and verified;

  update orders set status = 99, cancel_reason = r, cancelled_at = now(), cancelled_by = 'customer' where order_id = p_order;
  update quotations set status = 'rejected', responded_at = now() where order_id = p_order and status = 'sent';
  if dep > 0 and not exists (select 1 from payments where order_id = p_order and pay_type = 'refund') then
    insert into payments (order_id, amount, pay_type, verified) values (p_order, dep, 'refund', false);
  end if;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'shop', 0, o.order_code || ' · The customer cancelled' ||
    case when dep > 0 then '. A deposit refund of ' || dep || ' THB is pending' else '' end);
end $$;

-- ---------------------------------------------------------------- 5. refund bank account
create or replace function public.customer_refund_account_v2(p_payment bigint, p_account text) returns void
language plpgsql security definer set search_path = public as $$
declare cid bigint := customer_active_id_v2(); pay payments%rowtype; o orders%rowtype; acc jsonb;
begin
  select p.* into pay from payments p join orders x on x.order_id = p.order_id
   where p.payment_id = p_payment and x.customer_id = cid for update of p;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if pay.pay_type <> 'refund' or pay.verified then raise exception 'WRONG_STATUS'; end if;
  begin acc := p_account::jsonb; exception when others then raise exception 'INVALID_ACCOUNT'; end;
  if jsonb_typeof(acc) <> 'object'
     or length(trim(coalesce(acc->>'bank', ''))) < 2
     or length(trim(coalesce(acc->>'name', ''))) < 2
     or coalesce(acc->>'number', '') !~ '^[0-9]{8,20}$' then
    raise exception 'INVALID_ACCOUNT'; end if;
  update payments set refund_account = acc::text where payment_id = p_payment;
  select * into o from orders where order_id = pay.order_id;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (pay.order_id, 'shop', 0, o.order_code || ' · The customer sent the refund account');
end $$;

-- ---------------------------------------------------------------- 6. ask to move the install
create or replace function public.customer_request_reschedule_v2(p_order bigint, p_preferred timestamptz, p_reason text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  o orders%rowtype := customer_own_order_v2(p_order); appt appointments%rowtype;
  r text := nullif(trim(coalesce(p_reason, '')), '');
  notice int := coalesce((select value from business_rules where rule_key = 'reschedule_notice_days'), 1)::int;
  id bigint;
begin
  if r is null or length(r) < 5 or length(r) > 1000 then raise exception 'INVALID_NOTE'; end if;
  if o.status <> 8 then raise exception 'WRONG_STATUS'; end if;
  select * into appt from appointments where order_id = p_order and status = 'scheduled'
   order by created_at desc, appointment_id desc limit 1;
  if not found then raise exception 'WRONG_STATUS'; end if;
  if appt.install_datetime < now() + make_interval(days => notice) then raise exception 'RESCHEDULE_TOO_LATE'; end if;
  if p_preferred is null or p_preferred <= now() then raise exception 'Please choose a date in the future'; end if;
  if exists (select 1 from customer_reschedule_requests where order_id = p_order and status = 'pending') then
    raise exception 'REQUEST_PENDING'; end if;
  insert into customer_reschedule_requests (order_id, customer_id, appointment_id, preferred_datetime, reason)
  values (p_order, o.customer_id, appt.appointment_id, p_preferred, r) returning request_id into id;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'shop', 0, o.order_code || ' · The customer asks to move the install from ' ||
    to_char(appt.install_datetime at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI') || ' to ' ||
    to_char(p_preferred at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI') || ' · Reason: ' || r);
  return id;
end $$;

-- ---------------------------------------------------------------- who may call what
revoke all on function public.customer_own_order_v2(bigint) from public, anon, authenticated;
revoke all on function public.customer_bangkok_today_v2() from public, anon;
grant execute on function public.customer_bangkok_today_v2() to authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'customer_confirm_quote_v2(bigint)',
    'customer_submit_payment_v2(bigint, text, text, text, numeric, timestamptz)',
    'customer_record_acceptance_v2(bigint, boolean, text)',
    'customer_cancel_order_v2(bigint, text)',
    'customer_refund_account_v2(bigint, text)',
    'customer_request_reschedule_v2(bigint, timestamptz, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
