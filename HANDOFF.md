# Handoff: ICEFLOW customer site

Customer side of the SA project is handed to a new owner. This is everything needed to run it, change it, and know what is unfinished.

## 1. Run it (2 minutes)
1. Get invited to the Supabase organization **"CRM for ice making machine seller"** (project `ICEFLOW`, ref `neotkiugfgktrjyzrbji`, region ap-south-1). The owner invites you under *Organization → Team → Invite*. Role: Developer.
2. Supabase dashboard → Authentication → Sign In / Providers → Email → turn **off** "Confirm email" (otherwise new demo accounts cannot log in until they confirm).
3. Serve the repo root:
   ```bash
   python -m http.server 5500
   ```
   then open http://localhost:5500/customer/ (or use VS Code Live Server via `ICEFLOW.code-workspace`).

No install or build step. The Supabase URL and publishable key are in `customer/app.js` (safe to expose; row-level security protects the data).

## 2. What is built
Plain HTML/CSS/JS, one Supabase client (`customer/app.js`).

| Page | UC | Notes |
|---|---|---|
| `index.html` | – | landing page (receipt-on-clouds style) |
| `login.html` | UC8 | Supabase Auth; a DB trigger creates the `customers` row |
| `catalog.html` | UC1 step 1 | models from `machine_models` |
| `new-order.html` | UC1 step 2 | install address/power/space for the chosen model |
| `orders.html` | UC10 | my orders |
| `order.html` | UC9, UC10, UC7, UC11 | quote + deposit slip, timeline, acceptance + final payment, cancel, demo controls |

The order moves through statuses 0 to 10 (99 = cancelled). See `SA-project/README.md` for the status table and `supabase/migrations/` for the exact rules.

## 3. Database
`supabase/migrations/` holds all 5 migrations in order and matches what is live (checksummed against Supabase). To rebuild elsewhere: create a Supabase project and run them in order with the SQL editor or `supabase db push`.

- Customer actions are **RPC functions** (security definer, each checks the order belongs to the caller): `customer_accept_quote`, `customer_cancel_order`, `customer_submit_acceptance`.
- Status moves are validated by `status_transitions` + trigger `trg_check_status`. Every move writes `order_status_logs` and a customer `notifications` row.
- Slips go to the private `payment-slips` bucket, one folder per user id.
- Convention from the course: SQL names columns, never `*`.

## 4. Demo-only parts (remove before any real use)
- `demo_step(order)` and `demo_advance_to(order, status)` fake the shop and the factory (quote, verify slip, send to factory, produce, QC, schedule, install, verify final payment). The UI shows them in a collapsed "โหมดสาธิต" box on the order page.
- `machine_models` rows (IF-T05 ... IF-C05) and their prices are **sample data**.
- One seeded factory and three QC checklist items.

## 5. Known gaps / decisions to make
- Real catalog (names, capacities, prices, photos) is needed.
- One machine per order (no quantity).
- Shop (admin) and factory sites do not exist; in production the shop would create quotes and verify slips, the factory would answer and update production.
- Open question from the SA doc: who does QC, the shop or the factory?
- The UC document in `SA-project/` was written before the status renumbering; the database (and `SA-project/README.md` now) use the newer codes.
- No automated tests. DB flow was verified with a rolled-back SQL script; the pages were not click-tested end to end.
- Security advisor lists the customer RPCs and demo functions as callable by signed-in users. That is intentional (they are the API and check ownership), but the demo functions must go before real use.

## 6. Where things are
| Path | What |
|---|---|
| `customer/` | the customer website |
| `admin/` | the shop (admin) CRM |
| `factory/` | factory portal, not built yet (see its README) |
| `supabase/migrations/` | database, in order |
| `docs/intent/customer-site.md` | confirmed scope and decisions |
| `SA-project/README.md` | SA project overview: UCs, statuses, open issues |
| Figma file `JKNBpyS1vAUQkZPRkZX6FN` | UI reference and the new business-process swimlane |

## 7. Admin (shop) site
`admin/` is the shop CRM (plain HTML/JS, hash-routed, same Supabase project). Slice 1 covers Dashboard, Orders (All / New / Quotations / Cancelled), Manufacturing (Factory Requests / Production / QC), Installation + customer acceptance, and Payments (Deposit / Final / Refund). Customers, Factories, Notifications, Reports/History and Users & Roles are slice 2 (greyed "soon" in the sidebar).

- Staff access: a row in `users` (role `admin` or `shop`, `is_active`) linked by `auth_id` to a Supabase Auth account. `is_staff()` drives the RLS policies.
- Staff can only **read** orders/payments/etc. directly; every change goes through a `staff_*` function (`staff_create_quote`, `staff_verify_payment`, `staff_send_to_factory`, `staff_factory_response`, `staff_production`, `staff_qc_submit`, `staff_rework_done`, `staff_schedule_install`, `staff_confirm_installed`, `staff_cancel_order`, `staff_confirm_refund`).
- There is no factory site yet, so the shop records the factory's accept/reject, production progress and install confirmation on its behalf.
- Rejecting a payment slip deletes the payment row and notifies the customer, who then submits again (the old slip file stays in storage).

### Figma alignment (admin)
- Look follows the Figma "Shop / Admin" screens: dark sidebar, teal accent, white cards, breadcrumb bar, task list on the dashboard.
- Not built yet, shown in Figma: quantity per order, shipping/install fee and discount on quotes, saved quotation drafts and PDF preview, "request more info from customer", shop-created orders, company profile fields (tax id, contact person), attachments, transfer-matching panel on payment verification.
