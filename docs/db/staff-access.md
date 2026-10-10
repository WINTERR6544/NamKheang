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

## Quotation rejected and expired
Migrations `20261010150000_quotation_rejected_and_expiry.sql` and `20261010150100_quotation_expiry_schedule.sql`.
- A customer who cancels while the quote is still `sent` makes the quote `rejected` (`customer_cancel_order`).
- `expire_quotes()` runs every night at 00:00 Bangkok time (`pg_cron` job `expire-quotes`, 17:00 UTC). For each order still at status 1 whose latest quote is `sent`, past `valid_until`, with no deposit slip, it marks the quote `expired`, cancels the order (`cancelled_by = 'system'`, reason "Quotation expired") and notifies the customer and the shop.
- Quotes the customer already accepted (deposit slip sent) are never expired by the job.
- The function is not callable from the app; only the scheduler can run it. To run it by hand: `select public.expire_quotes();` in the SQL editor.

## Notifications, reminders and permissions (use case descriptions)
Migrations `20261010160000_use_case_notifications_reminders.sql` and `20261010160100_reminder_schedule.sql`.

| UC | What the database now does |
|---|---|
| UC4 / UC5 | `staff_send_to_factory` notifies the factory (`recipient_type = 'factory'`, `recipient_id = factory_id`). `staff_factory_response` notifies the shop (`recipient_id = 0`) with the factory's reply and reason. |
| UC4 exception | `remind_factories()` (job `remind-factories`, daily 09:00 Bangkok): an assignment still `pending` after `factory_reply_days` gets one reminder to the factory and one message to the shop (`factory_assignments.reminded_at`). |
| UC6 | The customer's "In production" message carries the estimated finish date. `remind_production_deadlines()` (job `remind-deadlines`, daily 09:00) reminds the factory once when the finish date is today or tomorrow (`orders.finish_reminded_at`, cleared when the date changes). |
| UC8 | `staff_schedule_install` also notifies the factory, and refuses to move an install date that is less than `reschedule_notice_days` away. |
| UC11 | The customer's "Cancelled" message includes the reason. `customer_cancel_order` requires a reason. |
| UC12 | A cancel with a verified deposit tells the shop a refund is pending (and, when the shop cancels, asks the customer for a bank account). `customer_set_refund_account(order, account)` lets the customer send or correct the account afterwards. |
| UC14 | `factories` can be changed only by role `admin` (`is_admin()`). Shop users can still read them. |

Not done on purpose: partial payments / "pay the shortfall" for the final payment (UC10), and the 7-day `final_payment_days` limit. Both need a policy decision.

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
