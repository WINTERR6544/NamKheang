# ICEFLOW — ระบบสั่งผลิตเครื่องทำน้ำแข็ง

SA course project. Plain HTML + CSS + JavaScript on Supabase (project `ICEFLOW`, ref `neotkiugfgktrjyzrbji`). Three front ends share one database.

| Folder | Who | Status |
|---|---|---|
| [`customer/`](customer/) | ลูกค้า: register, catalog, order, quote + deposit, tracking, acceptance + payment, cancel | built (handed to another dev) |
| [`admin/`](admin/) | ร้านขายเครื่องทำน้ำแข็ง (Shop / Admin CRM) | slice 1 built |
| [`factory/`](factory/) | โรงงาน | not built (placeholder README) |
| [`supabase/migrations/`](supabase/migrations/) | the database, in order | shared |
| [`docs/`](docs/), [`SA-project/`](SA-project/) | intent doc, SA overview (UCs, statuses, open issues) | shared |
| [`HANDOFF.md`](HANDOFF.md) | notes for the next owner | |

## Run (no build step)
From the repo root:

```bash
python -m http.server 5500
```

- Customer: http://localhost:5500/customer/
- Admin (shop): http://localhost:5500/admin/

In VS Code: open `ICEFLOW.code-workspace` and use Live Server on `customer/login.html` or `admin/index.html`.

Supabase Auth: turn off *Confirm email* (Authentication → Sign In / Providers → Email) or new accounts can't log in until they confirm.

## Staff login (admin)
Staff sign in with a Supabase account that has a row in `users` (role `admin` or `shop`). Register the account on the customer site first, then add the `users` row (see `HANDOFF.md`).

## Folder layout
```
customer/   index, login, catalog, new-order, orders, order, app.js, style.css
admin/      index.html, admin.css, js/{core,pages,order}.js
factory/    README.md (planned)
supabase/   migrations/*.sql
docs/       intent/customer-site.md
SA-project/ README.md
```

## Demo controls
On a customer order page, the collapsed "โหมดสาธิต" box plays the shop and factory. Remove `demo_step` / `demo_advance_to` in Supabase before any real use.

## Database notes
Status codes follow the live DB (`order_statuses`): 0 new, 1 quoted, 2 deposit_paid, 3 waiting_factory, 4 in_process, 5 waiting_qc, 6 rework, 7 qc_passed, 8 scheduled, 9 installed, 10 done, 99 cancelled. Deposit is 40% / final 60% (`business_rules.deposit_percent`).
