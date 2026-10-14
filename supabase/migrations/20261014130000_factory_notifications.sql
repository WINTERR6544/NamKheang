-- Factory portal, Dashboard: the factory reads the messages the system sends it (recipient_type 'factory',
-- recipient_id = its factory): install dates, deadline and reply reminders, problems the shop forwarded, a withdrawn request.
-- Adds one read policy; no existing policy is changed. Safe to re-run.
begin;

drop policy if exists "factory reads own notifications" on public.notifications;
create policy "factory reads own notifications" on public.notifications for select to authenticated
  using (recipient_type = 'factory' and recipient_id = public.my_factory_id());

commit;
