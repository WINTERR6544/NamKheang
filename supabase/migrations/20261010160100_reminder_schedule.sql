-- Reminder jobs: every day at 09:00 Bangkok time (02:00 UTC).
select cron.unschedule('remind-factories') where exists (select 1 from cron.job where jobname = 'remind-factories');
select cron.schedule('remind-factories', '0 2 * * *', $$select public.remind_factories()$$);
select cron.unschedule('remind-deadlines') where exists (select 1 from cron.job where jobname = 'remind-deadlines');
select cron.schedule('remind-deadlines', '0 2 * * *', $$select public.remind_production_deadlines()$$);
