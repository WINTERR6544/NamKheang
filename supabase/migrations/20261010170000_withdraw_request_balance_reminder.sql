-- Two shop-side gaps from the use case review (2026-10-10)
--   UC4/UC5: a factory that never replies blocks the order, because the shop cannot choose another factory
--            while the request is pending. The shop can now withdraw a request after factory_reply_days.
--   UC10:    final_payment_days was never used. A nightly job now reminds the customer and tells the shop
--            when an installed order has had no balance payment for that long (a reminder, not a cancel).

alter table public.orders add column if not exists final_reminded_at timestamptz;

-- ---------- UC4 / UC5: withdraw a request the factory has not answered ----------
create or replace function public.staff_withdraw_request(p_order bigint, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; a factory_assignments%rowtype; days int; why text;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 3 then raise exception 'The order is not waiting for a factory reply'; end if;
  select * into a from factory_assignments where order_id = p_order and response = 'pending'
   order by sent_at desc limit 1 for update;
  if not found then raise exception 'There is no pending request to withdraw'; end if;
  select coalesce((select value::int from business_rules where rule_key = 'factory_reply_days'), 3) into days;
  if a.sent_at > now() - make_interval(days => days) then
    raise exception 'The factory still has time to reply (% days). Try again after that', days; end if;
  why := coalesce(nullif(trim(p_reason), ''), 'Withdrawn by the shop: no reply within ' || days || ' days');
  update factory_assignments set response = 'rejected', reject_reason = why, responded_at = now()
   where assignment_id = a.assignment_id;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'factory', a.factory_id, o.order_code || ' · The shop withdrew the production request: ' || why);
end $$;
revoke execute on function public.staff_withdraw_request(bigint, text) from public, anon;
grant execute on function public.staff_withdraw_request(bigint, text) to authenticated;

-- ---------- UC10: balance not paid final_payment_days after the install ----------
create or replace function public.remind_final_payment() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0; days int;
begin
  select coalesce((select value::int from business_rules where rule_key = 'final_payment_days'), 7) into days;
  for r in
    select o.order_id, o.order_code, o.customer_id
      from orders o
     where o.status = 9 and o.installed_at is not null and o.installed_at < now() - make_interval(days => days)
       and o.final_reminded_at is null
       and not exists (select 1 from payments p where p.order_id = o.order_id and p.pay_type = 'final')
       -- not while a customer problem is open: the delay is not the customer's
       and not exists (select 1 from acceptance_checks a where a.order_id = o.order_id and not a.passed
                        and a.checked_at = (select max(checked_at) from acceptance_checks where order_id = o.order_id))
     for update of o
  loop
    update orders set final_reminded_at = now() where order_id = r.order_id;
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (r.order_id, 'customer', r.customer_id,
            r.order_code || ' · Reminder: please check the machine and pay the balance (installed more than ' || days || ' days ago)');
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (r.order_id, 'shop', 0, r.order_code || ' · The balance has not been paid ' || days || ' days after the install');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.remind_final_payment() from public, anon, authenticated;
