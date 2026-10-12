-- OPTIONAL production cutover: changes EXECUTE permissions of five old customer/demo APIs.
-- Apply after the team switches all customer callers to v2. No staff_* function is changed.
-- Save existing grants before running if the team needs a rollback.
begin;
revoke all on function public.customer_accept_quote(bigint,text,text),
  public.customer_cancel_order(bigint,text,text),
  public.customer_submit_acceptance(bigint,boolean,text,text,text),
  public.demo_step(bigint),public.demo_advance_to(bigint,smallint)
from public,anon,authenticated;
commit;
