-- More than one machine per order: orders.quantity (same model, 1 to 20).
-- Existing orders become quantity 1. The customer's create-order function gets an optional p_quantity (default 1),
-- so a caller that does not send it behaves as before. Nothing else changes: the shop prices the quote line by line.
begin;

alter table public.orders add column if not exists quantity integer not null default 1;
alter table public.orders drop constraint if exists orders_quantity_check;
alter table public.orders add constraint orders_quantity_check check (quantity between 1 and 20);

-- replace the 4-argument version (a second overload would make calls without p_quantity ambiguous)
drop function if exists public.customer_create_order_v2(bigint, text, text, text);
create or replace function public.customer_create_order_v2(
  p_model bigint, p_address text, p_power text default null, p_space text default null, p_quantity integer default 1)
returns bigint language plpgsql security definer set search_path = public as $$
declare cid bigint := public.customer_active_id_v2(); m public.machine_models%rowtype; oid bigint; contact public.customers%rowtype;
begin
  select * into contact from public.customers where customer_id = cid;
  if public.customer_normalize_phone(contact.phone) !~ '^0[0-9]{8,9}$' or char_length(trim(contact.name)) not between 2 and 120 then
    raise exception 'PROFILE_INCOMPLETE';
  end if;
  if char_length(trim(coalesce(p_address, ''))) not between 10 and 1000
     or char_length(coalesce(p_power, '')) > 200 or char_length(coalesce(p_space, '')) > 200 then
    raise exception 'INVALID_ADDRESS' using errcode = '23514';
  end if;
  if p_quantity is null or p_quantity not between 1 and 20 then
    raise exception 'INVALID_QUANTITY' using errcode = '23514';
  end if;
  select * into m from public.machine_models where model_id = p_model and is_active;
  if not found then raise exception 'MODEL_NOT_FOUND'; end if;
  insert into public.orders (customer_id, model_id, machine_type, capacity, install_address, install_power, install_space, quantity, status)
  values (cid, m.model_id, m.machine_type, m.capacity, trim(p_address), nullif(trim(p_power), ''), nullif(trim(p_space), ''), p_quantity, 0)
  returning order_id into oid;
  return oid;
end $$;

revoke all on function public.customer_create_order_v2(bigint, text, text, text, integer) from public, anon;
grant execute on function public.customer_create_order_v2(bigint, text, text, text, integer) to authenticated;

commit;
