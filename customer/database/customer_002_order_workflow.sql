begin;
-- Row locks serialize all new customer actions on the same order.
create or replace function public.customer_confirm_quote_v2(p_order bigint) returns void
language plpgsql security definer set search_path=public as $$
declare cid bigint:=public.customer_active_id_v2(); o public.orders%rowtype; q public.quotations%rowtype;
begin
  select * into o from public.orders where order_id=p_order and customer_id=cid for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status<>1 then raise exception 'WRONG_STATUS'; end if;
  if exists(select 1 from public.payments where order_id=p_order and pay_type='deposit') then raise exception 'PAYMENT_PENDING'; end if;
  select * into q from public.quotations where order_id=p_order order by created_at desc limit 1 for update;
  if not found or q.status not in ('sent','accepted') then raise exception 'WRONG_STATUS'; end if;
  if q.valid_until < (now() at time zone 'Asia/Bangkok')::date then raise exception 'QUOTE_EXPIRED'; end if;
  update public.quotations set status='accepted',responded_at=coalesce(responded_at,now()) where quotation_id=q.quotation_id;
end $$;

create or replace function public.customer_record_acceptance_v2(p_order bigint,p_passed boolean,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare cid bigint:=public.customer_active_id_v2(); o public.orders%rowtype; latest public.acceptance_checks%rowtype;
begin
  select * into o from public.orders where order_id=p_order and customer_id=cid for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status<>9 or p_passed is null then raise exception 'WRONG_STATUS'; end if;
  if exists(select 1 from public.payments where order_id=p_order and pay_type='final') then raise exception 'PAYMENT_PENDING'; end if;
  if char_length(trim(coalesce(p_note,''))) not between 5 and 1000 then raise exception 'INVALID_NOTE' using errcode='23514'; end if;
  select * into latest from public.acceptance_checks where order_id=p_order order by checked_at desc,check_id desc limit 1;
  -- Idempotent repeated acceptance confirmation, while allowing an honest problem report afterwards.
  if p_passed and latest.passed and latest.checked_at>=coalesce(o.installed_at,'-infinity'::timestamptz) then return; end if;
  insert into public.acceptance_checks(order_id,passed,note) values(p_order,p_passed,trim(p_note));
  if not p_passed then
    update public.appointments set status='rescheduled',reschedule_count=reschedule_count+1,reschedule_reason=trim(p_note)
    where appointment_id=(select appointment_id from public.appointments where order_id=p_order and status in ('completed','scheduled') order by created_at desc,appointment_id desc limit 1);
    update public.orders set status=8 where order_id=p_order;
  end if;
end $$;

create or replace function public.customer_submit_payment_v2(
  p_order bigint,p_type text,p_method text,p_slip text,p_amount numeric,p_paid_at timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare cid bigint:=public.customer_active_id_v2(); o public.orders%rowtype; q public.quotations%rowtype;
  expected numeric; dep numeric; accepted boolean; accepted_time timestamptz;
begin
  select * into o from public.orders where order_id=p_order and customer_id=cid for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if p_type not in ('deposit','final') or p_type is null then raise exception 'WRONG_STATUS'; end if;
  if p_method not in ('transfer','qr','cash') or p_method is null then raise exception 'INVALID_METHOD' using errcode='23514'; end if;
  if p_paid_at is null or p_paid_at>now()+interval '5 minutes' or p_paid_at<o.created_at-interval '1 day' then raise exception 'INVALID_PAYMENT_DATE' using errcode='23514'; end if;
  if exists(select 1 from public.payments where order_id=p_order and pay_type=p_type) then raise exception 'PAYMENT_PENDING'; end if;
  select * into q from public.quotations where order_id=p_order and status='accepted' order by created_at desc limit 1;
  if not found then raise exception 'WRONG_STATUS'; end if;
  if p_type='deposit' then
    if o.status<>1 then raise exception 'WRONG_STATUS'; end if;
    if q.valid_until<(now() at time zone 'Asia/Bangkok')::date then raise exception 'QUOTE_EXPIRED'; end if;
    expected=q.deposit_amount;
  else
    if o.status<>9 then raise exception 'WRONG_STATUS'; end if;
    select passed,checked_at into accepted,accepted_time from public.acceptance_checks
    where order_id=p_order order by checked_at desc,check_id desc limit 1;
    if not coalesce(accepted,false) or accepted_time<coalesce(o.installed_at,'-infinity'::timestamptz) then raise exception 'ACCEPTANCE_REQUIRED'; end if;
    select coalesce(sum(amount),0) into dep from public.payments where order_id=p_order and pay_type='deposit' and verified;
    expected=q.total_price-dep;
  end if;
  if expected<=0 or p_amount is null or p_amount<>expected then raise exception 'INVALID_AMOUNT' using errcode='23514'; end if;
  if p_method<>'cash' then
    if p_slip is null or split_part(p_slip,'/',1)<>auth.uid()::text or not exists(
      select 1 from storage.objects where bucket_id='payment-slips' and name=p_slip
        and lower(storage.extension(name)) in ('jpg','jpeg','png','pdf')
        and (metadata->>'size')::bigint between 1 and 10485760
        and metadata->>'mimetype' in ('image/jpeg','image/png','application/pdf')
        and not exists(select 1 from public.payments p where p.slip_path=p_slip)
    ) then raise exception 'INVALID_SLIP'; end if;
  else p_slip=null;
  end if;
  insert into public.payments(order_id,amount,pay_type,payment_method,slip_path,verified,paid_at)
  values(p_order,expected,p_type,p_method,p_slip,false,p_paid_at);
end $$;

create or replace function public.customer_cancel_order_v2(p_order bigint,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare cid bigint:=public.customer_active_id_v2(); o public.orders%rowtype; dep numeric;
begin
  select * into o from public.orders where order_id=p_order and customer_id=cid for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status=99 then return; end if;
  if o.status not in (0,1,2,3) then raise exception 'PRODUCTION_STARTED'; end if;
  if char_length(trim(coalesce(p_reason,''))) not between 5 and 1000 then raise exception 'INVALID_REASON' using errcode='23514'; end if;
  -- Do not lose a transfer that is still awaiting staff verification.
  if exists(select 1 from public.payments where order_id=p_order and pay_type='deposit' and not verified) then raise exception 'PAYMENT_PENDING'; end if;
  select coalesce(sum(amount),0) into dep from public.payments where order_id=p_order and pay_type='deposit' and verified;
  update public.orders set status=99,cancel_reason=trim(p_reason),cancelled_at=now(),cancelled_by='customer' where order_id=p_order;
  if dep>0 then insert into public.payments(order_id,amount,pay_type,verified) values(p_order,dep,'refund',false); end if;
end $$;

create or replace function public.customer_refund_account_v2(p_payment bigint,p_account text) returns void
language plpgsql security definer set search_path=public as $$
declare cid bigint:=public.customer_active_id_v2(); pay public.payments%rowtype; account jsonb;
begin
  select p.* into pay from public.payments p join public.orders o on o.order_id=p.order_id
  where p.payment_id=p_payment and o.customer_id=cid and o.status=99 and p.pay_type='refund' for update of p;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if pay.verified then raise exception 'WRONG_STATUS'; end if;
  account=p_account::jsonb;
  if char_length(trim(coalesce(account->>'bank',''))) not between 1 and 120
    or char_length(trim(coalesce(account->>'name',''))) not between 2 and 120
    or coalesce(account->>'number','')!~'^[0-9]{8,20}$'
    or public.customer_normalize_phone(account->>'phone')!~'^0[0-9]{8,9}$'
    or char_length(coalesce(account->>'branch',''))>120 then raise exception 'INVALID_ACCOUNT' using errcode='23514'; end if;
  update public.payments set refund_account=account::text where payment_id=p_payment;
end $$;

create table if not exists public.customer_reschedule_requests(
  request_id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(order_id) on delete cascade,
  customer_id bigint not null references public.customers(customer_id),
  preferred_datetime timestamptz not null,
  reason text not null,
  status text not null default 'pending' check(status in ('pending','resolved')),
  created_at timestamptz not null default now()
);
alter table public.customer_reschedule_requests enable row level security;
revoke all on public.customer_reschedule_requests from anon;
grant select on public.customer_reschedule_requests to authenticated;
create unique index if not exists customer_one_pending_reschedule on public.customer_reschedule_requests(order_id) where status='pending';
drop policy if exists "customer own reschedule requests" on public.customer_reschedule_requests;
create policy "customer own reschedule requests" on public.customer_reschedule_requests for select to authenticated
using(customer_id=public.customer_active_id_v2());
drop policy if exists "staff reads customer reschedule requests" on public.customer_reschedule_requests;
create policy "staff reads customer reschedule requests" on public.customer_reschedule_requests for select to authenticated using(public.is_staff());

create or replace function public.customer_request_reschedule_v2(p_order bigint,p_preferred timestamptz,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare cid bigint:=public.customer_active_id_v2(); o public.orders%rowtype; a public.appointments%rowtype; notice numeric;
begin
  select * into o from public.orders where order_id=p_order and customer_id=cid for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status<>8 then raise exception 'WRONG_STATUS'; end if;
  select * into a from public.appointments where order_id=p_order and status='scheduled' order by created_at desc limit 1;
  if not found then raise exception 'WRONG_STATUS'; end if;
  select value into notice from public.business_rules where rule_key='reschedule_notice_days';
  if a.install_datetime<now()+coalesce(notice,1)*interval '1 day' then raise exception 'RESCHEDULE_TOO_LATE'; end if;
  if p_preferred is null or p_preferred<=now() or char_length(trim(coalesce(p_reason,''))) not between 5 and 1000 then raise exception 'INVALID_REQUEST' using errcode='23514'; end if;
  if exists(select 1 from public.customer_reschedule_requests where order_id=p_order and status='pending') then raise exception 'REQUEST_PENDING'; end if;
  insert into public.customer_reschedule_requests(order_id,customer_id,preferred_datetime,reason) values(p_order,cid,p_preferred,trim(p_reason));
  -- Surface the request in the existing admin order detail notifications, without editing admin.
  insert into public.notifications(order_id,recipient_type,recipient_id,message)
  values(p_order,'customer',cid,o.order_code||' · ขอเลื่อนนัดเป็น '||to_char(p_preferred at time zone 'Asia/Bangkok','DD/MM/YYYY HH24:MI')||' · '||trim(p_reason)||' · รอร้านยืนยัน');
end $$;

create or replace function public.customer_resolve_reschedule_v2() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  update public.customer_reschedule_requests set status='resolved'
  where order_id=new.order_id and status='pending' and created_at<=new.created_at;
  return new;
end $$;
drop trigger if exists customer_resolve_reschedule on public.appointments;
create trigger customer_resolve_reschedule after insert on public.appointments for each row
execute function public.customer_resolve_reschedule_v2();

revoke all on function public.customer_confirm_quote_v2(bigint),public.customer_record_acceptance_v2(bigint,boolean,text),
  public.customer_submit_payment_v2(bigint,text,text,text,numeric,timestamptz),public.customer_cancel_order_v2(bigint,text),
  public.customer_refund_account_v2(bigint,text),public.customer_request_reschedule_v2(bigint,timestamptz,text) from public,anon;
grant execute on function public.customer_confirm_quote_v2(bigint),public.customer_record_acceptance_v2(bigint,boolean,text),
  public.customer_submit_payment_v2(bigint,text,text,text,numeric,timestamptz),public.customer_cancel_order_v2(bigint,text),
  public.customer_refund_account_v2(bigint,text),public.customer_request_reschedule_v2(bigint,timestamptz,text) to authenticated;
revoke all on function public.customer_resolve_reschedule_v2() from public,anon,authenticated;
commit;

