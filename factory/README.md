# Factory portal

Plain HTML/JS factory workspace on the same Supabase project, built like `admin/`: hash-routed, no build step, one file per page. Follows the Figma "ICEFLOW Factory" screens (Thai UI).

- `index.html`, `factory.css`: login gate, sidebar, topbar. Styles build on `../admin/admin.css`; `factory.css` only adds what the factory screens do differently.
- `js/core.js`: Supabase client, router, lazy feature loader, sidebar, icons (inline Lucide SVG), toast, Thai (Buddhist-era) dates
- `js/lib.js`: loading this factory's requests, status pills, the summary and capacity cards
- `js/features/`: one file per page, loaded the first time its page opens

Needs the `factory_access` migration and a factory account (see `docs/db/factory-access.md`).

Run from the repo root: `python -m http.server 5500`, then http://localhost:5500/factory/

## Pages
| File | Page | Route |
|---|---|---|
| `requests.js` | Manufacturing Requests: tabs (all / waiting / declined), search, month filter, sort, paging | `#/requests` |
| `request-detail.js` | one request: machine, customer and install site, summary | `#/requests/:orderId` |
| `request-evaluate.js` | accept or decline (reason required), review, confirm → `factory_respond` | `#/requests/:orderId/evaluate` |

Accepted requests leave this list; they continue on Production. Dashboard, Production, QC / Rework, Installation, Notifications and Profile are in the sidebar but not built yet (the page says so).

Still done by the shop on the factory's behalf from `admin/` until those phases are built:

| Factory action | Where it lives today |
|---|---|
| Start production + estimated finish date, progress, delay, finished | `staff_production` |
| Fix QC findings and resubmit | `staff_rework_done` |
| Confirm the install is done | `staff_confirm_installed` |

## Adding a page
1. Add `js/features/<name>.js` that calls `route(/^\/your\/path$/, async (el) => { ... })`.
2. Add `[/^\/your\/path$/, "<name>"]` to `FEATURES` (and a `NAV` entry if it is a sidebar item) in `core.js`.
