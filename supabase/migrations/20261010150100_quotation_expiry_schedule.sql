-- Run expire_quotes() every night at 00:00 Bangkok time (17:00 UTC).
create extension if not exists pg_cron;
select cron.unschedule('expire-quotes') where exists (select 1 from cron.job where jobname = 'expire-quotes');
select cron.schedule('expire-quotes', '0 17 * * *', $$select public.expire_quotes()$$);
