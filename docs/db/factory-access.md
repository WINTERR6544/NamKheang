# Factory access: database

Migration: `supabase/migrations/20261006120000_factory_access.sql`. Every screen in `factory/` depends on it. It only adds policies and functions; nothing the customer or shop sites use is changed. Safe to re-run (one transaction, `create or replace`, `drop policy if exists`).

The policies read through security-definer helpers (`my_factory_orders()`, `my_factory_customers()`) on purpose: "customer own orders" already reads `customers`, so a `customers` policy that read `orders` through RLS would recurse and break every orders/customers query.

## Who is a factory user
A Supabase account with an active row in `users` where `role = 'factory'` and `factory_id` is set (the table already requires the pair). `my_factory_id()` returns that factory for the signed-in user.

Add one from **Admin > Users & Roles** (an admin account, `admin_add_user`): role Factory, pick the factory. The person signs in with a Supabase Auth account with the same email; it is linked now if it exists, or when it is created (`link_user_on_signup`). An existing account can also be turned into a factory user with **Edit** (`admin_update_user`). See `20261010120000_admin_manage_users.sql`.

## What a factory can read
Only what was sent to it (`my_factory_orders()` = orders with a `factory_assignments` row for my factory):

- its own `factory_assignments` rows (pending, accepted, rejected)
- those `orders`, and the `customers` behind them (name, phone, email for the install)
- its own `factories` row (capacity per month)
- `machine_models` and `business_rules` were already readable by any signed-in user

## What a factory can do
| Function | Does | Allowed when | Order status |
|---|---|---|---|
| `factory_respond(p_order, p_accept, p_reason)` | accept, or decline with a reason (required); notifies the shop user who sent the request | my assignment is `pending` and the order is at 3 | stays 3 |

Same rules as `staff_factory_response`. The shop site no longer records replies for the factory, so this is the only way a request gets answered. After a decline the shop sends the order to another factory from `admin/` (Factory Requests). Production (3 → 4) is the next phase.

## Production (UC6)
Migration: `supabase/migrations/20261012120000_factory_production.sql` (adds only; safe to re-run).

The factory calls `factory_production(p_order, p_stage, p_est, p_note)`. It is factory-only (`is_factory()` and the order's factory): the shop QC-flow migration made `staff_production` factory-only, and `rename_staff_production_to_factory_production` (2026-10-13) renamed it:

| Stage | Allowed when | Result |
|---|---|---|
| `started` (estimated finish date required) | order at 3, accepted | 4 in_process, `started_at`, `est_finish_date` |
| `in_progress` / `delayed` | order at 4 | new `est_finish_date` (optional); `delayed` tells the customer |
| `finished` | order at 4 | 5 waiting_qc, `finished_at` |

Each call adds a `production_updates` row. The customer is told by `notify_status` (with the estimated finish date); the nightly `remind_production_deadlines` job reminds the factory when the date is due by tomorrow. The migration adds:

- `"factory reads own production updates"` on `production_updates` (the timeline on the job page)
- trigger `trg_notify_shop_production` on `orders`: a shop message (`recipient_id` 0) when production starts, when the estimated finish date changes, and when it is finished

## QC / Rework (UC7)
Migration: `supabase/migrations/20261013120000_factory_qc.sql` (adds only; safe to re-run).

Manufacturing QC is recorded by the factory (team decision in `docs/db/staff-access.md`; the UC document names the shop). Both functions are factory-only on the live database:

| Function | Allowed when | Result |
|---|---|---|
| `staff_qc_submit(p_order, p_results, 'production')` (every active `qc_items` row, `{item_id, passed, note}`) | order at 5 | every item passed: 7 qc_passed; any failed: 6 rework |
| `staff_rework_done(p_order)` | order at 6 | 5 waiting_qc (the next round) |

`business_rules.max_qc_rounds` (3) is shown as a warning; the shop decides on another factory. The migration adds:

- `"factory reads qc items"` on `qc_items` and `"factory reads own qc results"` on `qc_results` (the checklist and the rounds on the QC pages)
- shop messages in `notify_shop_production` for QC passed, QC failed (with the failed items and what to fix) and fixed work sent back for QC

### QC checklist text (Thai / English)
Migration: `supabase/migrations/20261013130000_qc_items_thai.sql` adds nullable columns to `qc_items` and fills the three current items:

| Column | Shown on the factory QC page |
|---|---|
| `item_name_th` | item title (the English `item_name` under it); empty = English name only |
| `description_th`, `description_en` | what to check, under the title |
| `fix_example_th` | placeholder of the "what to fix" box when an item fails |

To add or edit an item, edit `qc_items` (Supabase Table Editor, or as staff: the "staff manages qc_items" policy). No code change is needed. Existing reads and inserts that name only `item_name` are unaffected.

## Installation (UC8, UC9, UC10)
Migration: `supabase/migrations/20261014120000_factory_installation.sql` (adds only; safe to re-run).

- **UC8 (the shop books the date):** `staff_schedule_install` (staff) records the appointment, moves 7 → 8 (or 9 → 8 for a fix visit) and tells the customer and the factory. The factory asks the shop to move a date; it does not change dates itself.
- **UC9 (the factory confirms):** `staff_confirm_installed` (factory-only) needs a passing on-site QC (`staff_qc_submit(..., 'onsite')`, every active `qc_items` row) recorded after the current appointment was booked; then 8 → 9 and `installed_at`.
- **UC10 (a failed acceptance):** the customer reports a problem (order stays at 9); the shop forwards it (`staff_forward_problem`, tells the factory) and books a fix visit (UC8). The factory then tests on site and confirms again.

The migration adds:

- `"factory reads own appointments"` on `appointments`
- `"factory reads forwarded problems"` on `acceptance_checks` (only rows the shop forwarded)
- a shop message in `notify_shop_production` when the factory confirms the install (8 → 9)
