# Notes for the factory and customer developers (and their AI agents)

Written 2026-10-10 by the shop (admin) developer. Read the section for your portal, then "Shared facts".
Only what is **necessary** is listed. Each item says what breaks if it is not done.

The database is **already live** on Supabase project `neotkiugfgktrjyzrbji`. The SQL is in `supabase/migrations/`
on branch `feature/qc-flow-shop` (not merged into `main` yet). Do not wait for the merge: the live database already
behaves as described here.

---

## Shared facts

**Order statuses** (`orders.status`): 0 new · 1 quoted · 2 deposit_paid · 3 waiting_factory · 4 in_process ·
5 waiting_qc · 6 rework · 7 qc_passed · 8 scheduled · 9 installed · 10 done · 99 cancelled.
Moves are enforced by a trigger (`status_transitions`). You cannot skip a step.

**The QC and installation flow (decided, do not change):**
1. Manufacturing QC is done by the **factory only**. The shop only views it.
2. After installing, the **factory** records an **on-site QC** (stage `onsite`), then confirms the install (status 9).
3. The **customer** rechecks. If there is a problem: customer -> **shop** -> factory (never customer -> factory directly).

**Who may call what:** the functions named `staff_production`, `staff_qc_submit`, `staff_rework_done`,
`staff_factory_response` and `staff_confirm_installed` are **factory-only** (role `factory`, and only for orders assigned to
that user's factory). The `staff_` prefix is a leftover name. A shop login gets "Only the factory can ...".

**Notification addressing** (`notifications.recipient_type` / `recipient_id`): customer -> `customers.customer_id`,
factory -> `factories.factory_id`, shop -> `0`.

**Business rules** (`business_rules`): `factory_reply_days` = 3, `max_qc_rounds` = 3, `reschedule_notice_days` = 1,
`quote_valid_days` = 7, `final_payment_days` = 7, `deposit_percent` = 40.

**UC numbers** follow the Word report (UC1-UC15). The table is in `SA-project/README.md`.

**Rules for changing the database:** never edit an applied migration. Add a new file with a timestamp **after
`20261010170100`**. Test with a script that ends in `raise exception` so the data is rolled back.

---

## FACTORY portal (`factory/`)

### Critical: if you do not do these, the order flow stops

1. **Add read policies. A factory login cannot read these tables today** (only orders, customers, factory_assignments
   and its own factory row are readable). Without them the QC form has no checklist, the install date is invisible and
   notifications never show. Suggested migration:
   ```sql
   create policy "factory reads qc items" on public.qc_items for select to authenticated using (public.is_factory());
   create policy "factory reads own qc results" on public.qc_results for select to authenticated
     using (order_id in (select public.my_factory_orders()));
   create policy "factory reads own appointments" on public.appointments for select to authenticated
     using (order_id in (select public.my_factory_orders()));
   create policy "factory reads own production updates" on public.production_updates for select to authenticated
     using (order_id in (select public.my_factory_orders()));
   create policy "factory reads own notifications" on public.notifications for select to authenticated
     using (recipient_type = 'factory' and recipient_id = public.my_factory_id());
   ```

2. **Build the QC form (UC7)**, or orders stay at status 5 forever.
   `staff_qc_submit(p_order, p_results jsonb, p_stage text default 'production')`
   - `p_results` = `[{"item_id": 1, "passed": true, "note": "..."}]` and **must contain every active `qc_items` row**
     (otherwise "Please check every item").
   - `production` works at status 5 and moves to 7 (all passed) or 6 (any failed). Returns the new status.
   - After a fail the order is at 6. Call `staff_rework_done(p_order)` (6 -> 5) when it is fixed, then submit again.

3. **Build the on-site QC step, then "confirm installed" (UC9)**, or no order can ever reach status 9, so the customer
   can never accept or pay.
   - While the order is at 8 (install scheduled), call `staff_qc_submit(p_order, p_results, 'onsite')`. The status stays 8.
   - Then call `staff_confirm_installed(p_order)` (8 -> 9).
   - It **fails** with "Record the on-site QC before confirming the install" unless a **passing** on-site QC was recorded
     **after the current install appointment was created**. A fix visit (a new appointment) needs a new on-site QC.

4. **Production updates (UC6):** `staff_production(p_order, p_stage, p_est date, p_note)`.
   Stages: `started` (needs `p_est`, moves 3 -> 4), `in_progress`, `delayed` (notifies the customer),
   `finished` (4 -> 5, opens QC). Changing `p_est` re-arms the deadline reminder.

5. **Reply to a request:** `factory_respond(p_order, p_accept, p_reason)` (already in your branch) or
   `staff_factory_response(...)`. A decline needs a reason. The shop may **withdraw** a request after
   `factory_reply_days` with no reply, so a late reply gets "There is no request waiting for your reply". Show that message
   nicely and refresh the list.

### Important (not blocking)
- Show notifications of these kinds: new production order, reply reminder, request withdrawn, install scheduled /
  fix visit scheduled, customer problem forwarded by the shop, production deadline near.
- `docs/db/factory-access.md` says the shop can still call `staff_factory_response`. That is no longer true.

---

## CUSTOMER portal (`customer/`)

### Critical: if you do not do these, customers get stuck or confused

1. **A reported problem no longer moves the order.** `customer_submit_acceptance(p_order, false, p_note, ...)` now
   keeps the order at status 9 and records the problem (a note is required). Before, it moved the order back to 8
   immediately; the page probably still assumes that.
   - Show "Problem reported, waiting for the shop" when status = 9 and the newest `acceptance_checks` row has
     `passed = false`. Show the note and `checked_at`.
   - Disable submitting again while that is showing, or you create duplicate problems.
   - After the shop books a fix visit the order goes 9 -> 8 (an `appointments` row appears), then back to 9 when the
     factory confirms. The customer then rechecks and can accept.

2. **Cancel needs a reason.** `customer_cancel_order(p_order, p_reason, p_refund_account)` now raises
   "Please enter a reason" for an empty reason (the form must require it). It also marks an open quote `rejected`.
   Allowed only at statuses 0-3.

3. **Refund account after a shop cancel.** When the shop cancels an order that has a verified deposit, the refund row has
   no bank account and the customer gets a notification asking for it. New function:
   `customer_set_refund_account(p_order, p_account)`. **Without a form that calls it, the shop has to chase the
   account outside the system.** Show it on a cancelled order that has a refund payment with `verified = false` and an
   empty `refund_account`; the account can also be corrected until the refund is verified.

4. **Orders can now be cancelled by the system.** A quote not answered within 7 days is cancelled at midnight:
   `status = 99`, `cancelled_by = 'system'`, `cancel_reason = 'Quotation expired'`. Show the reason and who cancelled.
   `customer_accept_quote` also raises "The quotation has expired" after `valid_until`.

### Important (not blocking)
- Notifications are richer: "In production" includes the estimated finish date, and "Cancelled" includes the reason.
  No schema change, just display them.
- Reminders arrive as notifications: balance unpaid 7 days after the install; install scheduled; fix visit scheduled.
- UC1 gaps from the use case text: log in by phone, and block a duplicate phone number (`customers.phone` has no unique
  constraint). Not blocking.

---

## Quick check each portal can run
- Factory: log in as a factory user, open an order at status 5, submit a QC with every item passed. Expect status 7.
- Customer: at status 9 submit a problem. Expect status to stay 9 and a shop notification to appear.
