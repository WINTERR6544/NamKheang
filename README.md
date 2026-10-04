# ICEFLOW — ระบบสั่งผลิตเครื่องทำน้ำแข็ง (Customer site)

SA course demo. Plain HTML + CSS + JavaScript on Supabase (project `ICEFLOW`, ref `neotkiugfgktrjyzrbji`).

## Run in VS Code
1. File → Open Workspace from File → `ICEFLOW.code-workspace` (accept the Live Server recommendation).
2. Open `site/login.html` → right-click → **Open with Live Server**.

Without Live Server:

```bash
cd site
python -m http.server 5500
```

Then open http://localhost:5500.

Supabase Auth: turn off *Confirm email* (Authentication → Sign In / Providers → Email) or new accounts can't log in until they confirm.

## Layout
| Path | What |
|---|---|
| `site/login.html` | UC8 register / log in |
| `site/orders.html` | UC10 my orders |
| `site/catalog.html` | UC1 step 1: pick a model from the catalog (`machine_models`, sample data) |
| `site/new-order.html` | UC1 step 2: install details for the chosen model, then create the order |
| `site/order.html` | UC9 quote + deposit, UC10 timeline, UC7 acceptance + final payment, UC11 cancel, demo controls |
| `site/app.js` | Supabase client + shared helpers |
| `site/style.css` | styles |
| `docs/intent/customer-site.md` | confirmed scope for this build |
| `SA-project/README.md` | SA project overview (UCs, statuses, open issues) |

## Demo controls
On an order page, the collapsed "โหมดสาธิต" box plays the shop and factory (quote, verify slip, produce, QC, schedule, install, verify final payment). Remove `demo_step` / `demo_advance_to` in Supabase before any real use.

## Database notes
Status codes follow the live DB (`order_statuses`), which matches the new swimlane: 0 new, 1 quoted, 2 deposit_paid, 3 waiting_factory, 4 in_process, 5 waiting_qc, 6 rework, 7 qc_passed, 8 scheduled, 9 installed, 10 done, 99 cancelled.
