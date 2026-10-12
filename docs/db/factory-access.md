# Factory access: database

Migration: `supabase/migrations/20261006120000_factory_access.sql`. Every screen in `factory/` depends on it. It only adds policies and functions; nothing the customer or shop sites use is changed. Safe to re-run (one transaction, `create or replace`, `drop policy if exists`).

The policies read through security-definer helpers (`my_factory_orders()`, `my_factory_customers()`) on purpose: "customer own orders" already reads `customers`, so a `customers` policy that read `orders` through RLS would recurse and break every orders/customers query.

## Who is a factory user
A Supabase account with an active row in `users` where `role = 'factory'` and `factory_id` is set (the table already requires the pair). `my_factory_id()` returns that factory for the signed-in user.

Add one from **Admin > Users & Roles** (an admin account, `admin_add_user`): role Factory, pick the factory. The person signs in with a Supabase Auth account with the same email; it is linked now if it exists, or when it is created (`link_user_on_signup`). An existing account can also be turned into a factory user with **Edit** (`admin_update_user`). See `20261010120000_admin_manage_users.sql`.

## What a factory can read
Only what was sent to it (`my_factory_orders()` = orders with a `factory_assignments` row for my factory):

- its own `factory_assignments` rows (pending, accepted, rejected)
- those `orders`, and the `customers` behind them (name, phone, email for the install)
- its own `factories` row (capacity per month)
- `machine_models` and `business_rules` were already readable by any signed-in user

## What a factory can do
| Function | Does | Allowed when | Order status |
|---|---|---|---|
| `factory_respond(p_order, p_accept, p_reason)` | accept, or decline with a reason (required); notifies the shop user who sent the request | my assignment is `pending` and the order is at 3 | stays 3 |

Same rules as `staff_factory_response`. The shop site no longer records replies for the factory, so this is the only way a request gets answered. After a decline the shop sends the order to another factory from `admin/` (Factory Requests). Production (3 → 4) is the next phase.
