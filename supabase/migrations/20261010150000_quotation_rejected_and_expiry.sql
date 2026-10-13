-- Quotation rejected / expired (decided 2026-10-10)
--   * Customer cancels while the quote is still open  -> quote becomes "rejected" (order is cancelled as before).
--   * Quote passes valid_until with no answer          -> a nightly job marks it "expired" and cancels the
--     order with cancelled_by = 'system'. The customer and the shop are notified.

-- 1) customer cancel: also close the open quote as rejected
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
  update quotations set status = 'rejected', responded_at = now()
   where order_id = p_order and status = 'sent';
  if dep is not null then
    insert into payments (order_id, amount, pay_type, refund_account, verified)
    values (p_order, dep, 'refund', p_refund_account, false);
  end if;
end $$;

-- 2) expire open quotes (run nightly). Only quotes still "sent" on orders still at status 1 and with no deposit slip.
create or replace function public.expire_quotes() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in
    select q.quotation_id, o.order_id, o.order_code, o.customer_id
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
    values (r.order_id, 'customer', r.customer_id, r.order_code || ' · The quotation expired, so the order was cancelled');
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (r.order_id, 'shop', 0, r.order_code || ' · The quotation expired and the order was cancelled automatically');
    n := n + 1;
  end loop;
  return n;
end $$;
-- only the scheduler (and the owner) may run it
revoke execute on function public.expire_quotes() from public, anon, authenticated;
