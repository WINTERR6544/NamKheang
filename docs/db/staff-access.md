# Shop (staff) access: database

Migration: `supabase/migrations/20261004144505_admin_staff_access.sql`. Every shop screen in `admin/` depends on it.

## Who is staff
`is_staff()` is true when the signed-in Supabase user has an active row in `users` with role `admin` or `shop` (linked by `users.auth_id`). Add staff by registering an account on the customer site, then inserting the `users` row.

## What staff can do directly
- **Read** orders, customers, status logs, quotations (+ items), payments, QC results, appointments, factory assignments, production updates, acceptance checks and notifications.
- **Manage** `factories`, `qc_items` and `machine_models` (reference data).
- View and upload files in the private `payment-slips` bucket.

Everything else goes through checked functions (security definer, each starts with `is_staff()`):

| Function | Does | Allowed from status | Moves to |
|---|---|---|---|
| `staff_create_quote` | issue a quotation with items, VAT, deposit % and validity | 0 | 1 |
| `staff_verify_payment` | approve or reject a deposit/final slip (reject deletes the row and notifies the customer) | 1 (deposit), 9 (final) | 2, 10 |
| `staff_send_to_factory` | send the production order, or to another factory after a rejection | 2, 3 | 3 |
| `staff_factory_response` | record the factory's accept/reject (shop records on its behalf) | 3 | stays 3 |
| `staff_production` | started / in progress / delayed / finished | 3, 4 | 4, 5 |
| `staff_qc_submit` | record a QC round (every active item) | 5 | 7 or 6 |
| `staff_rework_done` | factory fixed the QC findings | 6 | 5 |
| `staff_schedule_install` | set or move the install date | 7, 8 | 8 |
| `staff_confirm_installed` | factory confirmed the install is done | 8 | 9 |
| `staff_cancel_order` | cancel before production starts, creates a refund row if a deposit was verified | 0-3 | 99 |
| `staff_confirm_refund` | attach the transfer slip and account for a refund | 99 | stays 99 |

Allowed status moves are enforced by `status_transitions` and a trigger.
