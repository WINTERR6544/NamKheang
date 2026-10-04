# Admin (shop) site

Plain HTML/JS shop CRM on the same Supabase project. Hash-routed; no build step.

- `index.html`, `admin.css`: login gate, sidebar, page chrome
- `js/core.js`: Supabase client, router, lazy feature loader, sidebar, modal/toast helpers
- `js/lib.js`: helpers shared by the pages (order and payment lists)
- `js/features/`: **one file per sidebar item**, loaded the first time its page opens. See its README for the list and how to add one.

A page whose feature file is not present shows "This page is not installed in this build", so feature branches can be merged in any order.

Needs `feature/admin-staff-access` (database) and a staff account (see `docs/db/staff-access.md`).

Run from the repo root: `python -m http.server 5500`, then http://localhost:5500/admin/
