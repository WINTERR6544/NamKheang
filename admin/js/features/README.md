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

## Helper features (not sidebar items)
Loaded on demand by other features or by the shell; they have no route of their own.

| File | What it is | Used by |
|---|---|---|
| `order-actions.js` | `loadOrder()` and `orderNext()`: an order's next step for the shop and the handler behind every button | the order page and the popup |
| `popup.js` | `openOrderPopup(id)`: side panel with the summary and next step; opens when any order row, card or link is clicked (Ctrl/Cmd-click opens the full page) | `core.js` click handler |
| `board.js` | `registerBoard()` / `renderBoard()`: puts every order in its column and draws the board | the List \| Board switch |
| `board-order.js` | columns for the Orders group: New, Quoted, Cancelled | `#/orders...?view=board` |
| `board-payments.js` | columns for Payments: Deposit, Final payment, Refund | `#/payments/...?view=board` |
| `board-mfg.js` | columns for Manufacturing and Installation: Factory, Production, QC, Install | `#/mfg/...`, `#/installation` with `?view=board` |

## List | Board
Pages in the Orders, Payments and Manufacturing/Installation sidebar groups show a **List | Board** switch (`?view=board`). The switch appears only when that group's `board-<group>.js` is installed. A card or row opens the popup; the popup's buttons call the same database actions as the full order page.

## Adding a feature
1. Add `js/features/<name>.js` that calls `route(/^\/your\/path$/, async (el) => { ... })`.
2. Add `[/^\/your\/path$/, "<name>"]` to `FEATURES` and a sidebar entry to `NAV` in `core.js`.

Shared helpers (`fetchOrders`, `head`, `ordersPage`, `paymentsPage`, ...) live in `../lib.js`; page chrome, modals, toasts, the router and login are in `../core.js`.
