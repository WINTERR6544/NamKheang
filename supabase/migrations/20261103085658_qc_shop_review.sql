-- UC7: the factory records the QC checklist, the shop checks the result.
--   factory: staff_qc_submit (production) records a round; the order stays 5 waiting_qc
--   shop:    staff_qc_review passes it (-> 7 qc_passed) or sends it back (-> 6 rework) with the items to fix and a note
--   factory: fixes, staff_rework_done (-> 5), records the next round
-- On-site QC at the install is unchanged (the factory records it, staff_confirm_installed checks it).

create table if not exists public.qc_reviews (
  review_id    bigint generated always as identity primary key,
  order_id     bigint not null references public.orders(order_id) on delete cascade,
  round_no     int not null,
  passed       boolean not null,
  failed_items bigint[] not null default '{}',
  note         text,
  reviewed_by  bigint references public.users(user_id),
  reviewed_at  timestamptz not null default now(),
  unique (order_id, round_no)
);
alter table public.qc_reviews enable row level security;
drop policy if exists "staff reads qc reviews" on public.qc_reviews;
create policy "staff reads qc reviews" on public.qc_reviews for select to authenticated using (public.is_staff());
drop policy if exists "factory reads own qc reviews" on public.qc_reviews;
create policy "factory reads own qc reviews" on public.qc_reviews for select to authenticated
  using (order_id in (select public.my_factory_orders()));
revoke all on public.qc_reviews from anon;

-- rounds recorded before this change were decided by the checklist itself; record them as reviewed
-- so orders already in QC carry on (the factory can record the next round).
insert into public.qc_reviews (order_id, round_no, passed, failed_items, note, reviewed_at)
select r.order_id, r.round_no, bool_and(r.passed),
       coalesce(array_agg(r.item_id order by r.item_id) filter (where not r.passed), '{}'),
       'Recorded before the shop review step', max(r.checked_at)
  from public.qc_results r
 where r.stage = 'production'
 group by r.order_id, r.round_no
on conflict (order_id, round_no) do nothing;
grant select on public.qc_reviews to authenticated;

create or replace function public.staff_qc_submit(p_order bigint, p_results jsonb, p_stage text default 'production')
returns smallint language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; rnd int; n_items int; n_given int; n_failed int;
begin
  if not is_factory() then raise exception 'Only the factory can record QC'; end if;
  if p_stage not in ('production', 'onsite') then raise exception 'Invalid QC stage'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.factory_id is distinct from my_factory_id() then raise exception 'This order is not assigned to your factory'; end if;
  if p_stage = 'production' and o.status <> 5 then raise exception 'The order is not waiting for QC'; end if;
  if p_stage = 'onsite' and o.status <> 8 then raise exception 'On-site QC is recorded while the install is scheduled'; end if;
  select count(*) into n_items from qc_items where is_active;
  select count(distinct (r->>'item_id')) into n_given from jsonb_array_elements(p_results) r
   where (r->>'item_id')::bigint in (select item_id from qc_items where is_active);
  if n_given <> n_items then raise exception 'Please check every item'; end if;
  select coalesce(max(round_no), 0) into rnd from qc_results where order_id = p_order and stage = p_stage;
  if p_stage = 'production' and rnd > 0 and not exists (select 1 from qc_reviews where order_id = p_order and round_no = rnd) then
    raise exception 'QC round % is waiting for the shop to review it', rnd; end if;
  rnd := rnd + 1;
  insert into qc_results (order_id, factory_id, round_no, item_id, stage, passed, note, checked_by)
  select p_order, o.factory_id, rnd, (r->>'item_id')::bigint, p_stage, (r->>'passed')::boolean, r->>'note', my_user_id()
  from jsonb_array_elements(p_results) r
  where (r->>'item_id')::bigint in (select item_id from qc_items where is_active);
  if p_stage = 'onsite' then return o.status; end if; -- status stays 8; staff_confirm_installed checks the result
  select count(*) into n_failed from qc_results where order_id = p_order and stage = 'production' and round_no = rnd and not passed;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'shop', 0, o.order_code || ' · The factory recorded QC round ' || rnd || ' (' ||
    case when n_failed = 0 then 'every item passed' else n_failed || ' item(s) failed' end || '). Please review the result');
  return o.status; -- stays 5 until the shop reviews
end $$;

create or replace function public.staff_qc_review(p_order bigint, p_pass boolean, p_note text default null, p_failed_items bigint[] default null)
returns smallint language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; rnd int; n text := nullif(trim(coalesce(p_note, '')), ''); failed bigint[]; names text;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  if n is not null and length(n) > 1000 then raise exception 'The note is too long (1000 characters at most)'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 5 then raise exception 'The order is not waiting for a QC review'; end if;
  select max(round_no) into rnd from qc_results where order_id = p_order and stage = 'production';
  if rnd is null then raise exception 'The factory has not recorded the QC yet'; end if;
  if exists (select 1 from qc_reviews where order_id = p_order and round_no = rnd) then
    raise exception 'QC round % has already been reviewed', rnd; end if;
  if p_pass then
    if exists (select 1 from qc_results where order_id = p_order and stage = 'production' and round_no = rnd and not passed) then
      raise exception 'Some QC items failed. Send it back to the factory to fix'; end if;
    insert into qc_reviews (order_id, round_no, passed, note, reviewed_by) values (p_order, rnd, true, n, my_user_id());
    update orders set status = 7 where order_id = p_order;
    insert into notifications (order_id, recipient_type, recipient_id, message)
    values (p_order, 'factory', o.factory_id, o.order_code || ' · The shop passed QC round ' || rnd || '. The shop will book the install');
    return 7;
  end if;
  -- send back: the shop's choice of items, or the items the factory failed
  failed := coalesce(p_failed_items,
    (select array_agg(item_id order by item_id) from qc_results where order_id = p_order and stage = 'production' and round_no = rnd and not passed), '{}');
  select array_agg(item_id order by item_id) into failed from qc_items where item_id = any (failed);
  failed := coalesce(failed, '{}');
  if cardinality(failed) = 0 and n is null then raise exception 'Choose the items to fix or write what needs fixing'; end if;
  select string_agg(coalesce(item_name_th, item_name), ', ' order by item_id) into names from qc_items where item_id = any (failed);
  insert into qc_reviews (order_id, round_no, passed, failed_items, note, reviewed_by) values (p_order, rnd, false, failed, n, my_user_id());
  update orders set status = 6 where order_id = p_order;
  insert into notifications (order_id, recipient_type, recipient_id, message)
  values (p_order, 'factory', o.factory_id, o.order_code || ' · QC round ' || rnd || ' sent back to fix' ||
    coalesce(': ' || names, '') || coalesce(' · ' || n, ''));
  return 6;
end $$;

revoke all on function public.staff_qc_review(bigint, boolean, text, bigint[]) from public, anon;
grant execute on function public.staff_qc_review(bigint, boolean, text, bigint[]) to authenticated;
