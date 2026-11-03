-- UC3 step 8 / UC10 step 3: the customer sees where to pay the deposit and the balance.
-- The admin enters the shop's real account and QR on the shop site (Admin > Payment details);
-- the customer payment pages read it. One row only. QR images go to the public bucket "shop-assets".
create table if not exists public.shop_payment_details (
  id             smallint primary key default 1 check (id = 1),
  bank_name      text,
  account_name   text,
  account_number text,
  promptpay_id   text,
  qr_url         text,
  note           text,
  updated_at     timestamptz not null default now(),
  updated_by     bigint references public.users(user_id)
);
insert into public.shop_payment_details (id) values (1) on conflict do nothing;
alter table public.shop_payment_details enable row level security;
drop policy if exists "signed-in reads shop payment details" on public.shop_payment_details;
create policy "signed-in reads shop payment details" on public.shop_payment_details for select to authenticated using (true);
revoke all on public.shop_payment_details from anon;
grant select on public.shop_payment_details to authenticated;

create or replace function public.admin_update_payment_details(p_bank text, p_account_name text, p_account_number text,
  p_promptpay text, p_qr_url text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare num text := nullif(regexp_replace(coalesce(p_account_number, ''), '[\s-]', '', 'g'), '');
        pp text := nullif(regexp_replace(coalesce(p_promptpay, ''), '[\s-]', '', 'g'), '');
        bank text := nullif(trim(coalesce(p_bank, '')), ''); acc text := nullif(trim(coalesce(p_account_name, '')), '');
        qr text := nullif(trim(coalesce(p_qr_url, '')), '');
begin
  if not is_admin() then raise exception 'Not authorised'; end if;
  if num is not null and num !~ '^[0-9]{8,20}$' then raise exception 'The account number must be 8–20 digits'; end if;
  if num is not null and (bank is null or acc is null) then raise exception 'Please enter the bank and the account name'; end if;
  if pp is not null and pp !~ '^([0-9]{10}|[0-9]{13})$' then raise exception 'PromptPay must be a 10-digit phone or 13-digit ID'; end if;
  if qr is not null and qr !~ '^https://' then raise exception 'The QR image must be an https link'; end if;
  if length(coalesce(bank, '')) > 100 or length(coalesce(acc, '')) > 200 or length(coalesce(p_note, '')) > 500 then
    raise exception 'A field is too long'; end if;
  update shop_payment_details set bank_name = bank, account_name = acc, account_number = num, promptpay_id = pp,
    qr_url = qr, note = nullif(trim(coalesce(p_note, '')), ''), updated_at = now(), updated_by = my_user_id() where id = 1;
end $$;
revoke all on function public.admin_update_payment_details(text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_update_payment_details(text, text, text, text, text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-assets', 'shop-assets', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "shop-assets: admin reads" on storage.objects;
create policy "shop-assets: admin reads" on storage.objects for select to authenticated
  using (bucket_id = 'shop-assets' and public.is_admin());
drop policy if exists "shop-assets: admin uploads" on storage.objects;
create policy "shop-assets: admin uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'shop-assets' and public.is_admin());
drop policy if exists "shop-assets: admin deletes" on storage.objects;
create policy "shop-assets: admin deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'shop-assets' and public.is_admin());
