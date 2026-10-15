-- Catch-up: objects the customer site uses that were created on the live project (SQL editor)
-- but never saved as a migration. Copied from the live database on 2026-10-15; safe to run again.
-- Without this file a database rebuilt from supabase/migrations/ has no customer profile fields,
-- no customer_active_id_v2 and no customer_*_v2 profile/notification functions.

alter table public.customers
  add column if not exists company text,
  add column if not exists contact_address text,
  add column if not exists is_active boolean not null default true;

create or replace function public.customer_normalize_phone(p_phone text) returns text
language sql immutable set search_path = public as $$
  select case when regexp_replace(coalesce(p_phone,''),'[[:space:]()-]','','g') like '+66%'
    then '0'||substr(regexp_replace(p_phone,'[[:space:]()-]','','g'),4)
    else regexp_replace(coalesce(p_phone,''),'[[:space:]()-]','','g') end
$$;

create or replace function public.customer_active_id_v2() returns bigint
language plpgsql stable security definer set search_path = public as $$
declare c public.customers%rowtype;
begin
  if auth.uid() is null then raise exception 'PROFILE_REQUIRED'; end if;
  select * into c from public.customers where auth_id=auth.uid();
  if not found then raise exception 'PROFILE_REQUIRED'; end if;
  if not c.is_active then raise exception 'CUSTOMER_INACTIVE'; end if;
  return c.customer_id;
end $$;

create or replace function public.customer_update_profile_v2(p_name text, p_phone text, p_company text, p_address text)
returns void language plpgsql security definer set search_path = public as $$
declare cid bigint:=public.customer_active_id_v2();
begin
  if char_length(trim(coalesce(p_name,''))) not between 2 and 120
     or public.customer_normalize_phone(p_phone)!~'^0[0-9]{8,9}$'
     or char_length(trim(coalesce(p_address,''))) not between 10 and 1000
     or char_length(coalesce(p_company,''))>200 then
    raise exception 'INVALID_PROFILE' using errcode='23514';
  end if;
  update public.customers set name=trim(p_name),phone=public.customer_normalize_phone(p_phone),
    company=nullif(trim(p_company),''),contact_address=trim(p_address)
  where customer_id=cid;
end $$;

create or replace function public.customer_read_notifications_v2(p_notification bigint default null)
returns void language plpgsql security definer set search_path = public as $$
declare cid bigint:=public.customer_active_id_v2();
begin
  update public.notifications set read_at=coalesce(read_at,now())
  where recipient_type='customer' and recipient_id=cid
    and (p_notification is null or notification_id=p_notification);
end $$;

create or replace function public.customer_sync_auth_email_v2() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.customers set email=new.email where auth_id=new.id;
  return new;
end $$;

create or replace function public.customer_validate_profile_v2() returns trigger
language plpgsql security definer set search_path = public as $$
declare module_signup boolean;
begin
  select coalesce((raw_user_meta_data->>'customer_module')='true',false) into module_signup
  from auth.users where id=new.auth_id;
  -- Unmarked staff provisioning keeps its existing behavior.
  if tg_op='INSERT' and module_signup then
    if char_length(trim(coalesce(new.name,''))) not between 2 and 120 then
      raise exception 'INVALID_NAME' using errcode='23514';
    end if;
    if public.customer_normalize_phone(new.phone)!~'^0[0-9]{8,9}$' then
      raise exception 'INVALID_PHONE' using errcode='23514';
    end if;
    -- Avoid the legacy ON CONFLICT DO NOTHING silently skipping this customer's profile.
    perform pg_advisory_xact_lock(hashtextextended(public.customer_normalize_phone(new.phone),0));
    if exists(select 1 from public.customers where public.customer_normalize_phone(phone)=public.customer_normalize_phone(new.phone)) then
      raise exception 'customer_unique_phone' using errcode='23505';
    end if;
  end if;
  if tg_op='UPDATE' and new.phone is distinct from old.phone and public.customer_normalize_phone(new.phone)!~'^0[0-9]{8,9}$' then
    raise exception 'INVALID_PHONE' using errcode='23514';
  end if;
  new.phone=public.customer_normalize_phone(new.phone);
  if tg_op='UPDATE' and new.name is distinct from old.name and char_length(trim(coalesce(new.name,''))) not between 2 and 120 then
    raise exception 'INVALID_NAME' using errcode='23514';
  end if;
  return new;
end $$;

drop trigger if exists customer_validate_profile on public.customers;
create trigger customer_validate_profile before insert or update of name, phone on public.customers
  for each row execute function public.customer_validate_profile_v2();
drop trigger if exists customer_sync_auth_email on auth.users;
create trigger customer_sync_auth_email after update of email on auth.users
  for each row when (old.email is distinct from new.email) execute function public.customer_sync_auth_email_v2();

-- storage: refund proof the shop uploads, and removing a slip that no payment uses
drop policy if exists "customer reads verified refund slips" on storage.objects;
create policy "customer reads verified refund slips" on storage.objects for select using (
  bucket_id = 'payment-slips' and exists (
    select 1 from public.payments p join public.orders o on o.order_id = p.order_id
    where p.slip_path = objects.name and p.pay_type = 'refund' and p.verified
      and o.customer_id = public.customer_active_id_v2()));
drop policy if exists "customer deletes unattached slips" on storage.objects;
create policy "customer deletes unattached slips" on storage.objects for delete using (
  bucket_id = 'payment-slips' and (storage.foldername(name))[1] = auth.uid()::text
  and not exists (select 1 from public.payments p where p.slip_path = objects.name));

revoke all on function public.customer_sync_auth_email_v2() from public, anon, authenticated;
revoke all on function public.customer_validate_profile_v2() from public, anon, authenticated;
revoke all on function public.customer_active_id_v2() from public, anon;
revoke all on function public.customer_normalize_phone(text) from public, anon;
revoke all on function public.customer_update_profile_v2(text, text, text, text) from public, anon;
revoke all on function public.customer_read_notifications_v2(bigint) from public, anon;
grant execute on function public.customer_active_id_v2() to authenticated;
grant execute on function public.customer_normalize_phone(text) to authenticated;
grant execute on function public.customer_update_profile_v2(text, text, text, text) to authenticated;
grant execute on function public.customer_read_notifications_v2(bigint) to authenticated;
