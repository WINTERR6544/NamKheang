-- Production updates are done by the factory, so the function is named for it.
-- Rename only: body, grants and callers' arguments are unchanged.
alter function public.staff_production(bigint, text, date, text) rename to factory_production;
