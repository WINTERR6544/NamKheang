# Factory access: database

Migration: `supabase/migrations/20261006120000_factory_access.sql`. Every screen in `factory/` depends on it. It only adds policies and functions; nothing the customer or shop sites use is changed. Safe to re-run (one transaction, `create or replace`, `drop policy if exists`).

The policies read through security-definer helpers (`my_factory_orders()`, `my_factory_customers()`) on purpose: "customer own orders" already reads `customers`, so a `customers` policy that read `orders` through RLS would recurse and break every orders/customers query.

## Who is a factory user
A Supabase account with an active row in `users` where `role = 'factory'` and `factory_id` is set (the table already requires the pair). `my_factory_id()` returns that factory for the signed-in user.

Add one: register the account on the customer site, then:

```sql
insert into users (auth_id, name, email, role, factory_id)
select id, 'Factory manager name', email, 'factory', 1   -- 1 = factories.factory_id
from auth.users where email = 'factory@example.com';
```

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

Same rules as `staff_factory_response` (the shop recording on the factory's behalf), which still works. After a decline the shop sends the order to another factory from `admin/` (Factory Requests). Production (3 → 4) is the next phase.
