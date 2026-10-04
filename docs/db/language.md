# Database text is English

Migration `20261004154706_db_english.sql` (already applied to the live project) translates the Thai text that lives in the database:

- order status descriptions (also used in customer notifications), business rule descriptions and units
- the sample catalog (machine type, capacity, description), the sample factory and the QC checklist items
- all error messages and customer notification text in the 16 functions that carried Thai (`customer_*`, `demo_*`, `staff_*`), re-created with `create or replace` (grants unchanged)

The earlier migrations still contain the original Thai strings because migrations are history; running all of them in order ends in English.

Depends on `feature/admin-staff-access` (the `staff_*` functions are defined there).
