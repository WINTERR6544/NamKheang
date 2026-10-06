-- Factory portal (factory/): a factory user is a row in users with role 'factory' and a factory_id.
-- A factory sees only the production requests sent to it and answers them itself (UC2: accept / decline with a reason).
-- Only ADDS factory access: no existing policy or function is changed. Safe to re-run (create or replace, drop policy if exists).
begin;

-- the signed-in user's factory (null for customers and shop staff)
create or replace function public.my_factory_id() returns bigint
language sql stable security definer set search_path = public as
$$ select factory_id from users where auth_id = auth.uid() and is_active and role = 'factory' $$;

-- orders ever sent to my factory, and their customers.
-- Security definer so the policies below never read orders/customers through RLS: "customer own orders" already reads
-- customers, so a customers policy that read orders under RLS would recurse.
create or replace function public.my_factory_orders() returns setof bigint
language sql stable security definer set search_path = public as
$$ select order_id from factory_assignments where factory_id = public.my_factory_id() $$;
create or replace function public.my_factory_customers() returns setof bigint
language sql stable security definer set search_path = public as
$$ select o.customer_id from orders o where o.order_id in (select public.my_factory_orders()) $$;

-- factory READS its own requests, the orders behind them, their customers and its own factory row
drop policy if exists "factory reads own assignments" on public.factory_assignments;
create policy "factory reads own assignments" on public.factory_assignments for select to authenticated
  using (factory_id = public.my_factory_id());
drop policy if exists "factory reads assigned orders" on public.orders;
create policy "factory reads assigned orders" on public.orders for select to authenticated
  using (order_id in (select public.my_factory_orders()));
drop policy if exists "factory reads assigned customers" on public.customers;
create policy "factory reads assigned customers" on public.customers for select to authenticated
  using (customer_id in (select public.my_factory_customers()));
drop policy if exists "factory reads own factory" on public.factories;
create policy "factory reads own factory" on public.factories for select to authenticated
  using (factory_id = public.my_factory_id());

-- UC2: the factory accepts or declines a request (decline needs a reason). The shop is notified.
-- Same rules as staff_factory_response; the order stays at 3 (production starts in UC4).
create or replace function public.factory_respond(p_order bigint, p_accept boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare fid bigint := my_factory_id(); r text := nullif(trim(p_reason), ''); a factory_assignments%rowtype; o orders%rowtype;
begin
  if fid is null then raise exception 'Not authorised'; end if;
  if not p_accept and r is null then raise exception 'Please give the reason for declining'; end if;
  if length(r) > 1000 then raise exception 'The reason is too long (1000 characters at most)'; end if;
  -- checked before touching the order, so a factory learns nothing about orders that were not sent to it
  if not exists (select 1 from factory_assignments where order_id = p_order and factory_id = fid and response = 'pending') then
    raise exception 'There is no request waiting for your reply'; end if;
  select * into o from orders where order_id = p_order for update;
  if o.status <> 3 then raise exception 'This order is no longer waiting for a factory reply'; end if;
  update factory_assignments
     set response = case when p_accept then 'accepted' else 'rejected' end,
         reject_reason = case when p_accept then null else r end, responded_at = now()
   where order_id = p_order and factory_id = fid and response = 'pending'
  returning * into a;
  if not found then raise exception 'There is no request waiting for your reply'; end if;
  if a.sent_by is not null then
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (p_order, 'shop', a.sent_by, o.order_code || ' · ' ||
      case when p_accept then 'The factory accepted the production request' else 'The factory declined: ' || r end);
  end if;
end $$;

revoke all on function public.my_factory_id(), public.my_factory_orders(), public.my_factory_customers(),
  public.factory_respond(bigint, boolean, text) from public, anon;
grant execute on function public.my_factory_id(), public.my_factory_orders(), public.my_factory_customers(),
  public.factory_respond(bigint, boolean, text) to authenticated;

commit;
