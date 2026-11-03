-- Fixes from the use-case check (UC3, UC2, factory privacy).

-- UC3 alt 2: when the shop rejects a deposit slip, the customer only re-attaches a slip.
-- The quotation stays accepted (before, it went back to "sent" and the customer had to accept it again).
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
    delete from payments where payment_id = p_payment; -- the customer attaches a new slip
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (o.order_id, 'customer', o.customer_id, o.order_code || ' · Payment proof rejected: ' || p_reason || ' Please send it again');
  end if;
end $$;

-- Privacy: a factory sees a customer's contact details only while the order is with that factory.
-- A factory that declined (or was replaced) keeps the order row for its history, without the customer's details.
create or replace function public.my_factory_customers() returns setof bigint
language sql stable security definer set search_path = public as $$
  select o.customer_id from orders o
   where o.factory_id = public.my_factory_id()
     and exists (select 1 from factory_assignments fa where fa.order_id = o.order_id
                  and fa.factory_id = o.factory_id and fa.response in ('pending', 'accepted'))
$$;

-- UC2 step 8: the shop is told when a customer places an order.
create or replace function public.notify_shop_new_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (new.order_id, 'shop', 0, new.order_code || ' · New order from the customer, waiting for a quotation');
  return new;
end $$;
drop trigger if exists trg_notify_shop_new_order on public.orders;
create trigger trg_notify_shop_new_order after insert on public.orders
  for each row execute function public.notify_shop_new_order();

-- Shop notifications page: mark shop messages read (shop messages are shared by all shop staff).
create or replace function public.staff_mark_notifications_read(p_ids bigint[] default null) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  update notifications set read_at = now()
   where recipient_type = 'shop' and read_at is null and (p_ids is null or notification_id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.notify_shop_new_order() from public, anon, authenticated;
revoke all on function public.staff_mark_notifications_read(bigint[]) from public, anon;
grant execute on function public.staff_mark_notifications_read(bigint[]) to authenticated;
revoke all on function public.my_factory_customers() from public, anon;
grant execute on function public.my_factory_customers() to authenticated;
