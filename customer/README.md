# Customer site

Plain HTML/CSS/JavaScript customer portal on the same Supabase project. Hash-routed; no build step.

- `index.html`, `customer.css`: app entrypoint, customer theme, sidebar, page chrome and responsive layouts based on the Figma customer page.
- `js/core.js`: application startup, customer auth gate, hash router, lazy feature loader and page lifecycle.
- `js/lib.js`: route map, URL/Auth callback helpers, data formatting, shared tables and event helpers.
- `js/customer_config.js`: Supabase connection and shop configuration.
- `js/customer_assets.js`: embedded images and icons from Figma.
- `js/components/`: reusable layout, forms, validation, profile cards, modal/toast helpers and order components.
- `js/services/`: customer-scoped Supabase Auth, profile, order, payment and notification services.
- `js/features/`: JavaScript features loaded when their page opens. Covers dashboard, orders, catalog/new order, quotation, payment, appointment, acceptance, cancellation, refund, receipt, notifications and profile. Some related routes share a feature file.

Open through an HTTP server, for example `index.html#/dashboard` or `index.html#/orders`. Order details use `index.html#/order/5` (replace `5` with an accessible order ID). Back/Forward and refresh work without server history fallback.

To add a protected page, create `js/features/customer_<name>.js`, export `render(context, el)` and register it in `js/lib.js`. Add its navigation entry in `js/components/customer_layout.js` and title in `js/customer_constants.js` if needed. Unknown routes or unavailable feature files show a recoverable error.

Needs a Supabase customer account, the customer database schema/RPCs and RLS policies. Phone login additionally needs the `customer_phone_login` Edge Function. These backend installation files are separate from this frontend module; opening the site does not install them. Configure Supabase Auth Redirect URLs for the customer `index.html` entrypoint and its callback query strings.

Profile/contact data is saved to Supabase `public.customers`; email changes go through Supabase Auth confirmation. Queries are scoped to the signed-in customer. Internet access is required for the Supabase SDK and Google Fonts.
