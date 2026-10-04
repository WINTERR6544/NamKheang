# Admin features

One file per sidebar item. The shell (`../core.js`) loads a feature's file the first time its page is opened, so a feature can be merged, removed or worked on without touching any other.

| File | Sidebar item | Route |
|---|---|---|
| `dashboard.js` | Dashboard | `#/dashboard` |
| `orders-all.js` | Orders > All Orders | `#/orders` |
| `orders-new.js` | Orders > New Orders | `#/orders/new` |
| `orders-quotations.js` | Orders > Quotations | `#/orders/quotations` |
| `orders-cancelled.js` | Orders > Cancelled | `#/orders/cancelled` |
| `order-detail.js` | (opened from any order) | `#/order/:id` |
| `mfg-requests.js` | Manufacturing > Factory Requests | `#/mfg/requests` |
| `mfg-production.js` | Manufacturing > Production | `#/mfg/production` |
| `mfg-qc.js` | Manufacturing > QC | `#/mfg/qc` |
| `installation.js` | Installation | `#/installation` |
| `payments-deposit.js` | Payments > Deposit | `#/payments/deposit` |
| `payments-final.js` | Payments > Final Payment | `#/payments/final` |
| `payments-refund.js` | Payments > Refund | `#/payments/refund` |

Not built yet (greyed "soon" in the sidebar): Customers, Factories, Notifications, Reports / History, Users & Roles.

## Adding a feature
1. Add `js/features/<name>.js` that calls `route(/^\/your\/path$/, async (el) => { ... })`.
2. Add `[/^\/your\/path$/, "<name>"]` to `FEATURES` and a sidebar entry to `NAV` in `core.js`.

Shared helpers (`fetchOrders`, `head`, `ordersPage`, `paymentsPage`, ...) live in `../lib.js`; page chrome, modals, toasts, the router and login are in `../core.js`.
