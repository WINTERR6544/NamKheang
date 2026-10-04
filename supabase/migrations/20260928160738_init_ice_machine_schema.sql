create table order_statuses (
  status_code  smallint primary key,
  name         text not null,
  description  text not null
);

insert into order_statuses (status_code, name, description) values
  (0,  'new',             'ลูกค้าส่งคำสั่งซื้อแล้ว'),
  (1,  'quoted',          'ร้านเสนอราคาแล้ว รอลูกค้ายืนยัน'),
  (2,  'deposit_paid',    'ชำระมัดจำแล้ว'),
  (3,  'waiting_factory', 'ส่งคำสั่งผลิต รอโรงงานตอบ'),
  (4,  'in_process',      'กำลังผลิต'),
  (5,  'waiting_qc',      'ผลิตเสร็จ รอ QC'),
  (6,  'rework',          'QC ไม่ผ่าน ส่งกลับแก้'),
  (7,  'qc_passed',       'ผ่าน QC'),
  (8,  'scheduled',       'นัดวันติดตั้งแล้ว'),
  (9,  'installed',       'โรงงานยืนยันติดตั้งเสร็จ'),
  (10, 'done',            'ตรวจรับและชำระครบ'),
  (99, 'cancelled',       'ยกเลิก');

create table customers (
  customer_id  bigint generated always as identity primary key,
  auth_id      uuid unique references auth.users(id) on delete set null,
  name         text not null,
  phone        text not null,
  email        text not null unique,
  created_at   timestamptz not null default now()
);

create table factories (
  factory_id          bigint generated always as identity primary key,
  name                text not null,
  contact_name        text,
  phone               text,
  capacity_per_month  int check (capacity_per_month >= 0),
  is_active           boolean not null default true
);

create table users (
  user_id     bigint generated always as identity primary key,
  auth_id     uuid unique references auth.users(id) on delete set null,
  name        text not null,
  email       text not null unique,
  role        text not null check (role in ('admin','shop','factory')),
  factory_id  bigint references factories(factory_id),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  check ((role = 'factory') = (factory_id is not null))
);

create table orders (
  order_id         bigint generated always as identity primary key,
  order_code       text unique,
  customer_id      bigint not null references customers(customer_id),
  factory_id       bigint references factories(factory_id),
  machine_type     text not null,
  capacity         text not null,
  install_address  text not null,
  install_power    text,
  install_space    text,
  status           smallint not null default 0 references order_statuses(status_code),
  sent_at          timestamptz,
  reject_reason    text,
  est_finish_date  date,
  finished_at      timestamptz,
  installed_at     timestamptz,
  cancel_reason    text,
  cancelled_at     timestamptz,
  created_at       timestamptz not null default now()
);

create table order_status_logs (
  log_id      bigint generated always as identity primary key,
  order_id    bigint not null references orders(order_id) on delete cascade,
  status      smallint not null references order_statuses(status_code),
  changed_by  bigint references users(user_id),
  note        text,
  changed_at  timestamptz not null default now()
);

create table factory_changes (
  change_id       bigint generated always as identity primary key,
  order_id        bigint not null references orders(order_id) on delete cascade,
  old_factory_id  bigint references factories(factory_id),
  new_factory_id  bigint not null references factories(factory_id),
  reason          text,
  changed_at      timestamptz not null default now()
);

create table quotations (
  quotation_id    bigint generated always as identity primary key,
  order_id        bigint not null references orders(order_id) on delete cascade,
  subtotal        numeric(12,2) not null check (subtotal >= 0),
  vat             numeric(12,2) not null default 0,
  total_price     numeric(12,2) not null,
  deposit_amount  numeric(12,2) not null check (deposit_amount >= 0),
  valid_until     date not null,
  created_at      timestamptz not null default now()
);

create table quotation_items (
  item_id       bigint generated always as identity primary key,
  quotation_id  bigint not null references quotations(quotation_id) on delete cascade,
  description   text not null,
  amount        numeric(12,2) not null
);

create table payments (
  payment_id      bigint generated always as identity primary key,
  order_id        bigint not null references orders(order_id) on delete cascade,
  amount          numeric(12,2) not null check (amount > 0),
  pay_type        text not null check (pay_type in ('deposit','final','refund')),
  payment_method  text check (payment_method in ('qr','transfer','cash')),
  slip_path       text,
  refund_account  text,
  verified        boolean not null default false,
  verified_by     bigint references users(user_id),
  reject_reason   text,
  paid_at         timestamptz not null default now()
);

create table qc_items (
  item_id    bigint generated always as identity primary key,
  item_name  text not null,
  is_active  boolean not null default true
);

create table qc_results (
  qc_id       bigint generated always as identity primary key,
  order_id    bigint not null references orders(order_id) on delete cascade,
  factory_id  bigint not null references factories(factory_id),
  round_no    int not null default 1,
  item_id     bigint not null references qc_items(item_id),
  passed      boolean not null,
  note        text,
  checked_by  bigint references users(user_id),
  checked_at  timestamptz not null default now(),
  unique (order_id, round_no, item_id)
);

create table appointments (
  appointment_id    bigint generated always as identity primary key,
  order_id          bigint not null references orders(order_id) on delete cascade,
  install_datetime  timestamptz not null,
  reschedule_count  int not null default 0,
  created_at        timestamptz not null default now()
);

create table notifications (
  notification_id  bigint generated always as identity primary key,
  order_id         bigint references orders(order_id) on delete cascade,
  recipient_type   text not null check (recipient_type in ('customer','shop','factory')),
  recipient_id     bigint not null,
  message          text not null,
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index on orders (customer_id);
create index on orders (factory_id);
create index on orders (status);
create index on order_status_logs (order_id, changed_at);
create index on payments (order_id);
create index on notifications (recipient_type, recipient_id, read_at);

create or replace function log_order_status() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into order_status_logs (order_id, status) values (new.order_id, new.status);
  end if;
  return new;
end $$;

create trigger trg_order_status
after insert or update of status on orders
for each row execute function log_order_status();

alter table customers          enable row level security;
alter table factories          enable row level security;
alter table users              enable row level security;
alter table orders             enable row level security;
alter table order_status_logs  enable row level security;
alter table factory_changes    enable row level security;
alter table quotations         enable row level security;
alter table quotation_items    enable row level security;
alter table payments           enable row level security;
alter table qc_items           enable row level security;
alter table qc_results         enable row level security;
alter table appointments       enable row level security;
alter table notifications      enable row level security;
alter table order_statuses     enable row level security;

create policy "anyone reads statuses" on order_statuses for select using (true);

create policy "customer own profile" on customers
  for select using (auth_id = auth.uid());

create policy "customer own orders" on orders
  for select using (customer_id in (select customer_id from customers where auth_id = auth.uid()));

create policy "customer creates order" on orders
  for insert with check (customer_id in (select customer_id from customers where auth_id = auth.uid()));

create policy "customer own timeline" on order_status_logs
  for select using (order_id in (
    select o.order_id from orders o join customers c on c.customer_id = o.customer_id
    where c.auth_id = auth.uid()));
