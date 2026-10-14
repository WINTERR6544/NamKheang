# Factory portal

Plain HTML/JS factory workspace on the same Supabase project, built like `admin/`: hash-routed, no build step, one file per page. Follows the Figma "ICEFLOW Factory" screens (Thai UI).

- `index.html`, `factory.css`: login gate, sidebar, topbar. Styles build on `../admin/admin.css`; `factory.css` only adds what the factory screens do differently.
- `js/core.js`: Supabase client, router, lazy feature loader, sidebar, icons (inline Lucide SVG), toast, Thai (Buddhist-era) dates
- `js/lib.js`: loading this factory's requests, status pills, the summary card
- `js/features/`: one file per page, loaded the first time its page opens

Needs the `factory_access` migration and a factory account (see `docs/db/factory-access.md`).

Run from the repo root: `python -m http.server 5500`, then http://localhost:5500/factory/

## Pages
| File | Page | Route |
|---|---|---|
| `dashboard.js` | Dashboard (home after login): cards (new requests, in production, rework, installs), every job waiting on the factory most urgent first with a link | `#/dashboard` |
| `requests.js` | Manufacturing Requests: tabs (all / waiting / declined), search, month filter, sort, paging | `#/requests` |
| `request-evaluate.js` | one request, opened from the list: summary, accept or decline (reason required), review, confirm → `factory_respond`; an answered request shows its result | `#/requests/:orderId/evaluate` |
| `production.js` | Production: active jobs only (3 waiting to start, 4 in production; filtered in the query), metrics, tabs, search, sort, due-soon banner. A finished job (5 waiting_qc and later) leaves the list | `#/production` |
| `production-detail.js` | one job, by stage: start with an estimated finish date; mark finished → 5 waiting_qc (main action); reschedule the estimated finish date in the plan card (later, or fixing a date before the start = delayed, customer told). All via `factory_production` | `#/production/:orderId` |
| `qc.js` | QC / Rework: orders in QC (5 waiting, 6 failed and being fixed, 7 passed), metrics, tabs, search, latest round per order | `#/qc` |
| `qc-detail.js` | one order, by status: record a QC round for every checklist item (fail needs what to fix) → `staff_qc_submit` → 7 or 6; fix and send back → `staff_rework_done` → 5; passed = read-only | `#/qc/:orderId` |
| `notifications.js` | Notifications (also the bell): the messages the system sent the factory, all / unread, a Thai category, title and summary per kind with the original text, a link to the page for it, mark one or all read (`factory_mark_notifications_read`) | `#/notifications` |
| `installation.js` | Installation schedule: booked (8, install or fix visit), waiting for the shop to book (7), installed (9); due-today banner, tabs, search, month, sort | `#/installation` |
| `installation-detail.js` | one job on one page: customer and site (map link), machine, the appointment and its history, a forwarded customer problem on a fix visit; when booked (8), the on-site test of every checklist item → `staff_qc_submit('onsite')`, all pass → `staff_confirm_installed` → 9; a fail is recorded and the order stays at 8; answer the booked date: keep it (`factory_confirm_appointment`) or ask the shop to move it with a new date and a reason (`factory_request_reschedule`); no test or confirm before the install day or while a move request waits | `#/installation/:orderId` |

Accepted requests leave this list; they continue on Production. Profile is in the sidebar but not built yet (the page says so).

The shop site is view-only for manufacturing (Factory Requests, Order Status). The factory steps and the database function behind each (all factory-only):

| Factory action | Phase | Database today |
|---|---|---|
| Accept / decline a request | 1 (built) | `factory_respond` |
| Start production + estimated finish date, progress, delay, finished | 2 Production (built) | `factory_production` |
| Record QC, fix QC findings and resubmit | 3 QC / Rework (built) | `staff_qc_submit`, `staff_rework_done` |
| On-site test and confirm the install is done | 4 Installation (built) | `staff_qc_submit('onsite')`, `staff_confirm_installed` |

## Adding a page
1. Add `js/features/<name>.js` that calls `route(/^\/your\/path$/, async (el) => { ... })`.
2. Add `[/^\/your\/path$/, "<name>"]` to `FEATURES` (and a `NAV` entry if it is a sidebar item) in `core.js`.
