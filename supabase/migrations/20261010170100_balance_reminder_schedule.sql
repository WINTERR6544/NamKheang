-- Balance reminder: every day at 09:00 Bangkok time (02:00 UTC).
select cron.unschedule('remind-balance') where exists (select 1 from cron.job where jobname = 'remind-balance');
select cron.schedule('remind-balance', '0 2 * * *', $$select public.remind_final_payment()$$);
