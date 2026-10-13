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
| `request-evaluate.js` | one request, opened from the list: summary, accept or decline (reason required), review, confirm → `factory_respond`; an answered request shows its result | `#/requests/:orderId/evaluate` |

Accepted requests leave this list; they continue on Production. Dashboard, Production, QC / Rework, Installation, Notifications and Profile are in the sidebar but not built yet (the page says so).

The shop site is view-only for manufacturing (Factory Requests, Order Status), so these factory steps have no screen until their phase is built. The database functions exist (shop-only for now):

| Factory action | Phase | Database today |
|---|---|---|
| Accept / decline a request | 1 (built) | `factory_respond` |
| Start production + estimated finish date, progress, delay, finished | 2 Production | `factory_production` |
| Fix QC findings and resubmit | 3 QC / Rework | `staff_rework_done` |
| Confirm the install is done | 4 Installation | `staff_confirm_installed` |

## Adding a page
1. Add `js/features/<name>.js` that calls `route(/^\/your\/path$/, async (el) => { ... })`.
2. Add `[/^\/your\/path$/, "<name>"]` to `FEATURES` (and a `NAV` entry if it is a sidebar item) in `core.js`.
