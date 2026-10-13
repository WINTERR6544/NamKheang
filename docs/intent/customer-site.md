# Intent: ICEFLOW customer site

Status: confirmed by user (2026-10-04)

- **Outcome:** A plain HTML/CSS/JS + Supabase customer website for ICEFLOW covering six UCs: register and log in (UC1), create an order (UC2), quotation and deposit slip (UC3), order tracking (UC13), accept and pay the balance (UC10), and cancel (UC11).
- **User:** The ice-machine buyer. The audience is the SA instructor and classmates seeing a demo.
- **Why now:** Course demo of the SA project (UC doc, swimlane, Figma) turned into a working system.
- **Success:** All six UCs run end to end on real ICEFLOW Supabase data. A hidden demo-controls panel moves an order to any status, so the whole flow can be shown in minutes.
- **Constraint:**
  - Database mirrors the UC doc's tables and columns. Status codes are the live DB's (0-10, 99) plus a status lookup table.
  - Every status change writes to `order_status_logs` and `notifications`.
  - SQL uses named columns, never `*`.
  - Login uses Supabase Auth, with a `customers` row created alongside it (`password_hash` dropped or placeholder).
  - Figma is a reference only; UI design is free.
- **Out of scope:** Shop (admin) and factory sites, real payment or email, installation, delivery, after-sales, the actual UC12 refund transfer (shown only as a status), production hardening.

## Decisions
- Shop and factory steps are faked with demo controls.
- Stack: started as Next.js + Supabase, switched to plain HTML/CSS/JS (no build step) at the user's request. Supabase project ICEFLOW, ref `neotkiugfgktrjyzrbji`.
- Database status codes follow the live DB (renumbered to match the new swimlane), not the older UC doc.
- Ordering flow: catalog (pick a model) -> details -> order.
