# Shop (staff) access: database

Migration: `supabase/migrations/20261004144505_admin_staff_access.sql`. Every shop screen in `admin/` depends on it.

## Who is staff
`is_staff()` is true when the signed-in Supabase user has an active row in `users` with role `admin` or `shop` (linked by `users.auth_id`). Add staff by registering an account on the customer site, then inserting the `users` row.

## What staff can do directly
- **Read** orders, customers, status logs, quotations (+ items), payments, QC results, appointments, factory assignments, production updates, acceptance checks and notifications.
- **Manage** `factories`, `qc_items` and `machine_models` (reference data).
- View and upload files in the private `payment-slips` bucket.

Everything else goes through checked functions (security definer). Shop functions start with `is_staff()`; factory functions start with `is_factory()` (migration `20261010140000_qc_flow_factory_checks_shop_views.sql`).

## QC and installation flow
- Manufacturing QC is recorded by the **factory only**. The shop only views it.
- At installation the **factory** does an **on-site QC** (`qc_results.stage = 'onsite'`), then confirms the install. The install cannot be confirmed without a passing on-site QC recorded after the current install date was set.
- The **customer** rechecks. A problem keeps the order at 9 and notifies the shop (`notifications`, `recipient_type = 'shop'`, `recipient_id = 0`). The shop forwards it to the factory (`staff_forward_problem`, sets `acceptance_checks.forwarded_at`, notifies the factory) and books a fix visit (`staff_schedule_install` from status 9, which moves it to 8 and notifies the factory). Then the factory does a new on-site QC and confirms the install again.

### Shop functions (`is_staff()`: role `admin` or `shop`)

| Function | Does | Allowed from status | Moves to |
|---|---|---|---|
| `staff_create_quote` | issue a quotation with items, VAT, deposit % and validity | 0 | 1 |
| `staff_verify_payment` | approve or reject a deposit/final slip (reject deletes the row and notifies the customer) | 1 (deposit), 9 (final) | 2, 10 |
| `staff_send_to_factory` | send the production order, or to another factory after a rejection | 2, 3 | 3 |
| `staff_schedule_install` | set or move the install date; from 9 it books a fix visit after a customer problem | 7, 8, 9 (only with a customer problem) | 8 |
| `staff_forward_problem` | send the customer's problem to the factory | 9 (latest acceptance failed) | stays 9 |
| `staff_cancel_order` | cancel before production starts, creates a refund row if a deposit was verified | 0-3 | 99 |
| `staff_confirm_refund` | attach the transfer slip and account for a refund | 99 | stays 99 |

### Factory functions (`is_factory()`: role `factory`, only for orders assigned to the user's factory)

| Function | Does | Allowed from status | Moves to |
|---|---|---|---|
| `staff_factory_response` | accept or decline a production order | 3 | stays 3 |
| `staff_production` | started / in progress / delayed / finished | 3, 4 | 4, 5 |
| `staff_qc_submit(order, results, stage)` | record a QC round for every active item. `stage` is `production` (default) or `onsite` | 5 (production), 8 (onsite) | 7 or 6; on-site stays 8 |
| `staff_rework_done` | the factory fixed the QC findings | 6 | 5 |
| `staff_confirm_installed` | the factory confirms the install, after a passing on-site QC | 8 | 9 |

The factory functions kept their `staff_` names so existing callers do not change, but the shop (admin) can no longer call them.

Allowed status moves are enforced by `status_transitions` and a trigger.
