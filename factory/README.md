# Factory portal (not built yet)

Placeholder for the factory side of ICEFLOW.

Today the shop records the factory's actions on its behalf from `admin/` (Factory Requests, Production, "installed" confirmation). A factory portal would let the factory do these itself, using the same Supabase project and tables:

| Factory action | Where it lives today |
|---|---|
| Accept / reject a production request (with reason) | `staff_factory_response` |
| Start production + estimated finish date, progress, delay, finished | `staff_production` |
| Fix QC findings and resubmit | `staff_rework_done` |
| Confirm the install is done | `staff_confirm_installed` |

Needed to build it:
- a `users` row with `role = 'factory'` and a `factory_id` (the table already enforces this pairing)
- factory-scoped RLS policies (a factory sees only its own orders) and `factory_*` functions mirroring the shop ones above
- screens from the Figma "factory" flow (4 steps: today's jobs → production orders → order detail → delivery/arrival)
