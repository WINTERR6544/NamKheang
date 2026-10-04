create table factory_assignments (
  assignment_id  bigint generated always as identity primary key,
  order_id       bigint not null references orders(order_id) on delete cascade,
  factory_id     bigint not null references factories(factory_id),
  sent_by        bigint references users(user_id),
  sent_at        timestamptz not null default now(),
  response       text not null default 'pending' check (response in ('pending','accepted','rejected')),
  reject_reason  text,
  responded_at   timestamptz
);
create unique index one_pending_assignment on factory_assignments (order_id) where response = 'pending';
create index on factory_assignments (factory_id);
drop table factory_changes;
alter table orders drop column reject_reason;

alter table quotations
  add column status text not null default 'sent' check (status in ('sent','accepted','rejected','expired')),
  add column responded_at timestamptz,
  add column created_by bigint references users(user_id);

alter table orders
  add column started_at   timestamptz,
  add column accepted_at  timestamptz,
  add column cancelled_by text check (cancelled_by in ('customer','shop','system'));

create table production_updates (
  update_id        bigint generated always as identity primary key,
  order_id         bigint not null references orders(order_id) on delete cascade,
  stage            text not null check (stage in ('started','in_progress','finished','delayed')),
  est_finish_date  date,
  note             text,
  updated_by       bigint references users(user_id),
  created_at       timestamptz not null default now()
);
create index on production_updates (order_id, created_at);

alter table appointments
  add column status text not null default 'scheduled' check (status in ('scheduled','rescheduled','completed','cancelled')),
  add column reschedule_reason text,
  add column created_by bigint references users(user_id);

create table acceptance_checks (
  check_id    bigint generated always as identity primary key,
  order_id    bigint not null references orders(order_id) on delete cascade,
  passed      boolean not null,
  note        text,
  checked_at  timestamptz not null default now()
);

alter table payments add column receipt_no text unique;

create table business_rules (
  rule_key     text primary key,
  value        numeric not null,
  unit         text not null,
  description  text not null
);
insert into business_rules values
  ('deposit_percent',        30, '%',   'มัดจำคิดเป็นกี่ % ของราคารวม'),
  ('quote_valid_days',        7, 'วัน', 'อายุใบเสนอราคา'),
  ('factory_reply_days',      3, 'วัน', 'โรงงานต้องตอบรับภายใน'),
  ('max_qc_rounds',           3, 'รอบ', 'QC ไม่ผ่านได้สูงสุดก่อนพิจารณาเปลี่ยนโรงงาน'),
  ('reschedule_notice_days',  1, 'วัน', 'ต้องแจ้งเลื่อนนัดล่วงหน้า'),
  ('final_payment_days',      7, 'วัน', 'ชำระยอดคงเหลือภายในหลังตรวจรับ');

create table status_transitions (
  from_status  smallint references order_statuses(status_code),
  to_status    smallint references order_statuses(status_code),
  primary key (from_status, to_status)
);
insert into status_transitions values
  (0,1),(0,99),(1,2),(1,99),(2,3),(2,99),(3,4),(3,99),
  (4,5),(5,6),(5,7),(6,5),(7,8),(8,9),(9,8),(9,10);

create or replace function check_status_transition() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status and not exists (
    select 1 from status_transitions where from_status = old.status and to_status = new.status) then
    raise exception 'status change % → % is not allowed', old.status, new.status;
  end if;
  return new;
end $$;
create trigger trg_check_status before update of status on orders
for each row execute function check_status_transition();

create or replace function set_order_code() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.order_code is null then
    new.order_code := 'ORD-' || (extract(year from now())::int + 543) || '-' || lpad(new.order_id::text, 4, '0');
  end if;
  return new;
end $$;
create trigger trg_order_code before insert on orders
for each row execute function set_order_code();

create view v_factory_performance with (security_invoker = true) as
select f.factory_id, f.name,
  count(fa.assignment_id) filter (where fa.response = 'accepted') as accepted_jobs,
  count(fa.assignment_id) filter (where fa.response = 'rejected') as rejected_jobs,
  (select count(*) from qc_results q where q.factory_id = f.factory_id and not q.passed) as qc_failed_items
from factories f left join factory_assignments fa on fa.factory_id = f.factory_id
group by f.factory_id, f.name;

alter table factory_assignments enable row level security;
alter table production_updates  enable row level security;
alter table acceptance_checks   enable row level security;
alter table business_rules      enable row level security;
alter table status_transitions  enable row level security;
create policy "signed-in reads rules" on business_rules for select to authenticated using (true);
create policy "signed-in reads transitions" on status_transitions for select to authenticated using (true);

insert into storage.buckets (id, name, public) values ('payment-slips', 'payment-slips', false)
on conflict (id) do nothing;
